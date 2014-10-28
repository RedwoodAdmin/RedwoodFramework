import os
import sys
paths = ['C:\Users\User\Desktop\Projects', 'C:\Users\User\Desktop\Projects\redwood']
for path in paths:
    if path not in sys.path:
        sys.path.append(path)

os.environ['DJANGO_SETTINGS_MODULE'] = 'redwood.settings'

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
