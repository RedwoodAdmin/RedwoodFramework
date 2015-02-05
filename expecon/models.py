from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.utils.encoding import smart_str
from django.template import loader
from django.template import Template, Context
from django.core.urlresolvers import reverse
from fields import *
import datetime
import uuid
import os
import json
import redis
import csv
import random
	
class Experiment(models.Model):
	experimenter = models.ForeignKey(User)
	name = models.CharField(max_length=100, unique=True)
	comments = models.TextField(blank=True)
	admin_html = HTMLField(blank=True)
	admin_css = CSSField(blank=True)
	admin_js = JSField(blank=True)
	rt_js = JSField(verbose_name="Realtime Analytics", blank=True)
	
	def __str__(self):
		return smart_str(self.name)
		
	def save(self, *args, **kwargs):
		first_save = not self.pk
		if self.admin_html.strip() == "":
			self.admin_html = loader.render_to_string('default_admin_page.html', {'name': self.name})
		if self.admin_css.strip() == "":
			self.admin_css = loader.render_to_string('default_page.css')
		if self.admin_js.strip() == "":
			self.admin_js = loader.render_to_string('default_admin_page.js')
		super(Experiment, self).save(*args, **kwargs)
		if first_save:
			Page(experiment=self, name="Wait").save()
			Page(experiment=self, name="Start").save()
			Page(experiment=self, name="Finish").save()
		
	def clone(self):
		clone = Experiment()
		clone.experimenter = self.experimenter
		clone.name = "%s Clone" % (self.name,)
		count = Experiment.objects.filter(name__contains=clone.name).count()
		if count > 0:
			clone.name = "%s Clone %d" % (self.name, count)
		clone.comments = self.comments
		clone.admin_html = self.admin_html
		clone.admin_css = self.admin_css
		clone.admin_js = self.admin_js
		clone.rt_js = self.rt_js
		clone.save()
		clone.page_set.all().delete()
		for page in self.page_set.all():
			page.clone(clone)
		clone.save()
		return clone
	
class Session(models.Model):
	experiment = models.ForeignKey(Experiment)
	comments = models.TextField(blank=True)
	archive = models.TextField(blank=True)
	
	def __str__(self):
		return smart_str('%d' % (self.id))
	
	def get_absolute_url(self):
		return reverse('expecon.views.session_admin', args=(self.id,))
		
class Page(models.Model):
	experiment = models.ForeignKey(Experiment)
	name = models.CharField(max_length=100)
	html = HTMLField(blank=True)
	css = CSSField(blank=True)
	js = JSField(blank=True)
	
	def __str__(self):
		return smart_str(self.experiment.name + ' - ' + self.name)
		
	def save(self, *args, **kwargs):
		if self.html.strip() == "":
			template = 'default_page.html'
			if self.name == 'Wait':
				template = 'default_wait_page.html'
			elif self.name == 'Start':
				template = 'default_start_page.html'
			elif self.name == 'Finish':
				template = 'default_finish_page.html'
			self.html = loader.render_to_string(template, {
				'name': self.name,
				'verbatim': '{% verbatim %}',
				'endverbatim': '{% endverbatim %}'
			})
		if self.js.strip() == "":
			template = 'default_page.js'
			if self.name == 'Wait':
				template = 'default_wait_page.js'
			elif self.name == 'Start':
				template = 'default_start_page.js'
			elif self.name == 'Finish':
				template = 'default_finish_page.js'
			self.js = loader.render_to_string(template)
		if self.css.strip() == "":
			self.css = loader.render_to_string('default_page.css')
		super(Page, self).save(*args, **kwargs)
		
	def render(self, context_instance=None):
		template = Template('{% autoescape off %}' + self.html + '{% endautoescape %}')
		if context_instance:
			context = context_instance
		else:
			context = Context()
		context.update({ 'js': self.js, 'css': self.css, 'experiment': self.experiment })
		return template.render(context)
		
	def clone(self, experiment):
		clone = Page()
		clone.experiment = experiment
		clone.name = self.name
		clone.html = self.html
		clone.css = self.css
		clone.js = self.js
		clone.save()
		return clone
