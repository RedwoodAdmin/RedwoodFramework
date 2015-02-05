from models import *
from django.contrib.sites.models import Site
from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.template import RequestContext, Context, loader
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.core.urlresolvers import reverse
from django.db.models import Q
from django.conf import settings
from django.core import serializers
from to_csv import queue_to_csv
import json
import datetime
import subprocess
import redis
import csv
import functools
import urllib
import cStringIO
import zipfile
import codecs

''' Displays the admin_html/css/js page defined for the given session's experiment '''
@login_required
def session_admin(request, session):
	session = get_object_or_404(Session, pk=session)
	return HttpResponse(
		Page(experiment=session.experiment,
				 name="Admin",
				 html=session.experiment.admin_html,
				 css=session.experiment.admin_css,
				 js=session.experiment.admin_js).render(context_instance=RequestContext(request)))

''' Displays the rt_js page defined for the given session's experiment '''
@login_required			 
def session_data(request, session):
	session = get_object_or_404(Session, pk=session)
	if request.method == 'POST':
		session.experiment.rt_js = request.POST["script"]
		session.experiment.save()
	return render_to_response('session_data.html', {'session': session}, context_instance=RequestContext(request))

''' Displays the session_payouts.html template '''
@login_required	
def session_payouts(request, session):
	session = get_object_or_404(Session, pk=session)
	return render_to_response('session_payouts.html',
		context_instance=RequestContext(request))
		
''' 
	Downloads the session queue from Redis, then converts to a csv file.
	Fields of the message objects are converted to columns of the csv file.
	Objects in a field are recursively added as columns, with list objects
	suffixed by the list index.
	E.g.
		{
			"Key": "foo",
			"Value": {
				"bar": "bang",
				"baz": [5, 3, 0]
			}
		}
	Would yield:
	Key, Value, Value.bar, Value.baz0, Value.baz1, Value.baz2
	foo,      , bang     , 5         , 3         , 0
'''
@login_required	
def session_download(request, session):
	session = get_object_or_404(Session, pk=session)
	s = cStringIO.StringIO()
	w = csv.writer(s)
	r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_DB)
	instance = settings.URL_PREFIX.strip('/')
	queue = map(json.loads, r.lrange('session:%s:%d' % (instance, session.id), 0, -1))
	# the filename is suffixed by the timestamp of the first message in the queue
	timestamp = datetime.datetime.fromtimestamp(queue[0]['Time'] / 1e9)
	rows = queue_to_csv(queue)
	w.writerows(rows)
	response = HttpResponse(s.getvalue(), content_type='text/csv')
	s.close()
	response['Content-Disposition'] = 'attachment; filename=%s-%s.csv' % (session.experiment.name, timestamp)
	return response

''' Save session queue and definition to the SQL session object, so it can easily be backed up '''
@login_required
def session_archive(request, session):
	if request.method == 'GET':
		session = get_object_or_404(Session, pk=session)
		r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_DB)
		instance = settings.URL_PREFIX.strip('/')
		queue = map(json.loads, r.lrange('session:%s:%d' % (instance, session.id), 0, -1))
		session.archive = ''
		objs = [session, session.experiment] + list(session.experiment.page_set.all())
		definition = json.loads(serializers.serialize('json', objs))
		session.archive = json.dumps({
			'definition': definition,
			'queue': queue,
		})
		session.save()
		return HttpResponseRedirect('/session/%d/admin' % (session.id,))
	return HttpResponse(status=405)

''' Display the current page (defined in the Redis database) for the given subject '''
def session_experiment(request, session, subject):
	session = get_object_or_404(Session, pk=session)
	r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=settings.REDIS_DB)
	instance = settings.URL_PREFIX.strip('/')
	period = r.get('period:%s:%s:%s' % (instance, session.id, subject))
	if not period or period == "0":
		page = get_object_or_404(session.experiment.page_set, name='Wait')
	else:
		page_name = r.get('page:%s:%s:%s' % (instance, session.id, subject))
		page = get_object_or_404(session.experiment.page_set, name=page_name)
	return HttpResponse(page.render(context_instance=RequestContext(request)))

'''
	An insecure hack to get around browser cross-site security.
	Fetches and returns the data from 'url' given in a GET request.
'''	
def get_outside_page(request, session):
	session = get_object_or_404(Session, pk=session)
	url = request.GET.get('url')
	if url == None:
		return HttpResponse('Missing required arg url', status=405)
	f = urllib.urlopen(url)
	page = f.read()
	f.close()
	return HttpResponse(page)

''' Copies the given experiment to a new experiment '''
@login_required	
def clone_experiment(request, experiment):
	experiment = get_object_or_404(Experiment, pk=experiment)
	if request.method == 'POST':
		clone = experiment.clone()
		return HttpResponseRedirect('%s/admin/expecon/experiment/%d' % (settings.URL_PREFIX, clone.id))
	return HttpResponse(status=405)

'''
	Downloads the experiment definition for either backup purposes, or for upload to 
	another redwood instance.
'''	
@login_required	
def download_experiment(request, experiment):
	experiment = get_object_or_404(Experiment, pk=experiment)
	objs = [experiment]
	objs += experiment.page_set.all()
	response = HttpResponse(serializers.serialize("json", objs), content_type='application/json')
	response['Content-Disposition'] = 'attachment; filename=%s.json' % (experiment.name,)
	return response
	
'''
	Uploads a definition obtained by download_experiment into the database.
	This will overwrite any data/page definitions that already exist in the given experiment.
'''
@login_required	
def upload_experiment(request, experiment):
	if experiment == 'add':
		# If this is a new experiment, create it
		name = 'Experiment %d' % len(Experiment.objects.all())
		experimenter = User.objects.first()
		experiment = Experiment(name=name, experimenter=experimenter)
		experiment.save()
	else:
		# If this experiment is already saved, retreive it
		experiment = get_object_or_404(Experiment, pk=experiment)
	
	if request.method == 'POST':
		if 'file' not in request.FILES:
			return HttpResponse(status=405)
		experiment.page_set.all().delete()
		for obj in serializers.deserialize('json', request.FILES['file'].read()):
			if type(obj.object) == Experiment:
				experiment.comments = obj.object.comments
				experiment.admin_html = obj.object.admin_html
				experiment.admin_css = obj.object.admin_css
				experiment.admin_js = obj.object.admin_js
				experiment.rt_js = obj.object.rt_js
				experiment.save()
			elif type(obj.object) == Page:
				clone = Page(experiment=experiment, name=obj.object.name)
				clone.html = obj.object.html
				clone.css = obj.object.css
				clone.js = obj.object.js
				clone.save()
		return HttpResponseRedirect('%s/admin/expecon/experiment/%d' % (settings.URL_PREFIX, experiment.id))
	return HttpResponse(status=405)
