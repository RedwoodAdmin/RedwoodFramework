import os
import sys
paths = ['C:\Users\User\Desktop\Projects', 'C:\Users\User\Desktop\Projects\redwood']
for path in paths:
    if path not in sys.path:
        sys.path.append(path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'redwood.settings'

import django.core.handlers.wsgi
application = django.core.handlers.wsgi.WSGIHandler()
