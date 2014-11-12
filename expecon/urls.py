from django.conf.urls import patterns, include, url

urlpatterns = patterns('expecon.views',
	url(r'^session/(?P<session>\d+)/admin$', 'session_admin'),
	url(r'^session/(?P<session>\d+)/admin/data$', 'session_data'),
	url(r'^session/(?P<session>\d+)/admin/payouts$', 'session_payouts'),
	url(r'^session/(?P<session>\d+)/admin/download$', 'session_download'),
	url(r'^session/(?P<session>\d+)/admin/archive$', 'session_archive'),
	url(r'^session/(?P<session>\d+)/subject/(?P<subject>\d+)/?$', 'session_experiment'),
	url(r'^session/(?P<session>\d+)/get_outside_page$', 'get_outside_page'),
	url(r'^admin/expecon/experiment/(?P<experiment>\d+)/clone$', 'clone_experiment'),
	url(r'^admin/expecon/experiment/(?P<experiment>\d+)/download$', 'download_experiment'),
	url(r'^admin/expecon/experiment/(?P<experiment>\d+)/upload$', 'upload_experiment'),
	url(r'^admin/expecon/experiment/(add)/upload$', 'upload_experiment'),
)
