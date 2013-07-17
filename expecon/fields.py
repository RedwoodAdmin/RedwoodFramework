from django.db import models

class HTMLField(models.TextField):
	description = "A textfield for raw HTML"
	
class CSSField(models.TextField):
	description = "A textfield for CSS"
	
class JSField(models.TextField):
	description = "A textfield for Javascript"
