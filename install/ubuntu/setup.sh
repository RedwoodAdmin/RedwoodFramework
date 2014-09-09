# Install necessary tools, apache/redis server, and libraries
sudo apt-get update
sudo apt-get install apache2
sudo apt-get install golang
sudo apt-get install libapache2-mod-wsgi
sudo apt-get install redis-server
sudo apt-get install python-redis
sudo apt-get install git
sudo apt-get install python-pip

# Install Django and reversion
pip install django==1.7
pip install django-reversion==1.8.4

# Clone Redwood from GitHub repository
cd /var
sudo mkdir www
cd /var/www
sudo git clone https://github.com/RedwoodAdmin/RedwoodFramework.git redwood

# Pull Redwood apache WSGI config from wiki
cd redwood
sudo wget https://github.com/RedwoodAdmin/RedwoodResources/raw/master/ServerSetup/Linux/apache.tar.gz
sudo tar xzvf apache.tar.gz

# Compile expecon-router
cd go
mkdir pkg
mkdir bin
sudo echo "GOPATH=\"/var/www/redwood/go\"" >> /etc/environment
export GOPATH="/var/www/redwood/go"
cd src/redis-go
sudo go install
cd ../websocket
sudo go install
cd ../expecon-router
sudo go install

# Create log.txt file
cd ../../..
sudo touch log.txt

# Initialize database, move static files to apache-accessible folder
sudo python manage.py syncdb
sudo python manage.py collectstatic

# Make /var/www/redwood owned by apache (www-data), and readable by group ubuntu (Amazon EC2 login)
#sudo chown -R www-data:ubuntu .
sudo chown -R www-data .
sudo chmod -R g+rw .

# Overwrite old apache configuration file with new one pulled from wiki
cd /etc/apache2/sites-enabled
sudo wget https://github.com/RedwoodAdmin/RedwoodResources/raw/master/ServerSetup/Linux/redwood.conf -O 000-default

# Create upstart job to automatically start expecon-router on startup
cd /etc/init
sudo wget https://github.com/RedwoodAdmin/RedwoodResources/raw/master/ServerSetup/Linux/redwood-router.conf

# Restart instance
