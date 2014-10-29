#
# Redwood 2 setup script. 
#
# For use with Ubuntu + Apache 2
#
# Requires root permissions.
#

if [[ "$(whoami)" != "root" ]]; then
    echo The setup script must be run as root.
    exit
fi

# Install necessary tools, apache/redis server, and libraries
apt-get update
apt-get install apache2
apt-get install golang
apt-get install libapache2-mod-wsgi
apt-get install redis-server
apt-get install python-redis
apt-get install sendmail # needed for default logging settings
apt-get install python-pip

# Install Django and reversion
pip install django==1.7
pip install django-reversion==1.8.4

# Copy WSGI script and default Redwood configuration to /var/www/redwood/apache
cd /var/www/redwood
mkdir apache
cp install/ubuntu/config.json apache
cp install/ubuntu/django.wsgi apache

# Compile expecon-router
OLDGOPATH=${GOPATH}

export GOPATH="/var/www/redwood/go"
cd go/src/redis-go
go install
cd ../websocket
go install
cd ../expecon-router
go install

GOPATH=${OLDGOPATH}

# Initialize database, move static files to apache-accessible folder
cd /var/www/redwood
python manage.py syncdb
python manage.py collectstatic

# Overwrite old apache configuration file with new one pulled from wiki
cd /etc/apache2/sites-available
cp /var/www/redwood/install/ubuntu/apache/redwood.conf ./redwood.conf
cd /etc/apache2/sites-enabled
ln -s ../sites-available/redwood.conf
rm 000-default.conf

# Create log.txt file
touch /var/www/redwood/log.txt
chmod -R a+rw /var/www/redwood
chown -R www-data /var/www/redwood

# Create upstart job to automatically start expecon-router on startup
cd /etc/init
cp /var/www/redwood/install/ubuntu/redwood-router.conf ./redwood-router.conf

# Restart instance
service apache2 stop
service apache2 start
service redwood-router start