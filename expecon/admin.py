from models import *
from widgets import CodeEditorWidget
from django.contrib import admin
from django import forms
from django.forms.models import BaseInlineFormSet, ModelForm
import reversion
	
class PageInline(admin.StackedInline):
	model = Page
	extra = 0
	formfield_overrides = {
		HTMLField: {'widget': CodeEditorWidget(mode='html')},
		CSSField: {'widget': CodeEditorWidget(mode='css')},
		JSField: {'widget': CodeEditorWidget(mode='javascript')},
	}
	
@admin.register(Page)
class PageAdmin(reversion.VersionAdmin):
	formfield_overrides = {
		HTMLField: {'widget': CodeEditorWidget(mode='html')},
		CSSField: {'widget': CodeEditorWidget(mode='css')},
		JSField: {'widget': CodeEditorWidget(mode='javascript')},
	}
	
class AlwaysChangedModelForm(ModelForm):
	def has_changed(self):
		''' Should return True if data differs from initial. 
				By always returning true even unchanged inlines will get validated and saved.'''
		return True
	
class SessionInline(admin.StackedInline):
	model = Session
	extra = 0

	fields = ('comments', 'subject_pages')
	readonly_fields = ('experiment', 'id', 'subject_pages')
	view_on_site = True
	form = AlwaysChangedModelForm

	# A hacky way to get subject pages to show on admin page.
	def subject_pages(self, obj):
		if obj.id:
			view = 'expecon.views.session_experiment'
			template = '<a href="%s">Subject %d</a>'
			links = []
			for i in range(4):
				subject = i + 1
				url = reverse(view, args=(obj.id, subject))
				link = template % (url, subject)
				links.append(link)

			return ', '.join(links)
		else:
			return None
	subject_pages.allow_tags = True

@admin.register(Experiment)
class ExperimentAdmin(reversion.VersionAdmin):
	inlines = (PageInline, SessionInline)
	formfield_overrides = {
		HTMLField: {'widget': CodeEditorWidget(mode='html')},
		CSSField: {'widget': CodeEditorWidget(mode='css')},
		JSField: {'widget': CodeEditorWidget(mode='javascript')},
	}
