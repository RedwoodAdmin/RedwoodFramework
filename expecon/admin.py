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
	readonly_fields = ('experiment','id')
	view_on_site = True
	form = AlwaysChangedModelForm
    
@admin.register(Experiment)
class ExperimentAdmin(reversion.VersionAdmin):
	inlines = (PageInline, SessionInline)
	formfield_overrides = {
		HTMLField: {'widget': CodeEditorWidget(mode='html')},
		CSSField: {'widget': CodeEditorWidget(mode='css')},
		JSField: {'widget': CodeEditorWidget(mode='javascript')},
	}
