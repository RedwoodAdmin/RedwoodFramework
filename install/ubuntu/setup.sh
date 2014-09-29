# Install necessary tools, apache/redis server, and libraries
sudo apt-get update
sudo apt-get install apache2
sudo apt-get install golang
sudo apt-get install libapache2-mod-wsgi
sudo apt-get install redis-server
sudo apt-get install python-redis
sudo apt-get install git

# Install Django
wget https://www.djangoproject.com/download/1.4.2/tarball/ -O Django-1.4.2.tar.gz
tar xzvf Django-1.4.2.tar.gz
cd Django-1.4.2
sudo python setup.py install

# Clone Redwood from GitHub repository
sudo mkdir /var/www
cd /var/www
sudo git clone https://github.com/RedwoodAdmin/RedwoodFramework.git redwood

cd redwood
sudo mkdir go/pkg
sudo mkdir go/bin
sudo touch log.txt

sudo chmod -R a+rw .
sudo chown -R www-data .

sudo tar xzvf install/ubuntu/resources/apache.tar.gz

# Compile expecon-router
export GOPATH="/var/www/redwood/go"
cd go/src/redis-go
go install
cd ../websocket
go install
cd ../expecon-router
go install

# Initialize database, move static files to apache-accessible folder
cd /var/www/redwood
sudo python manage.py syncdb
sudo python manage.py collectstatic

# Overwrite old apache configuration file with new one pulled from wiki
cd /etc/apache2/sites-enabled
sudo cp /var/www/redwood/install/ubuntu/resources/redwood.conf ./000-default.conf
sudo cp 000-default.conf 000-default

# Create log.txt file
sudo chmod -R a+rw /var/www/redwood
sudo chown -R www-data /var/www/redwood

# Create upstart job to automatically start expecon-router on startup
cd /etc/init
sudo cp /var/www/redwood/install/ubuntu/resources/redwood-router.conf ./redwood-router.conf

# Restart instance
sudo reboot