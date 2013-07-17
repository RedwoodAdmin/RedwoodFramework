from django.test import TestCase
from django.contrib.auth.models import User
from models import *
import random
import datetime
from decimal import *

alphabet = [chr(i) for i in range(97,123)]

def random_name():
	return ''.join([random.choice(alphabet) for i in range (10)])
	
def random_date():
	random_second = random.randrange(364 * 24 * 60 * 60)
	return datetime.datetime.now() + datetime.timedelta(seconds=random_second)

class SimpleTest(TestCase):
	def setUp(self):
		for i in range(10):
			User.objects.create_user(random_name(), random_name() + '@example.com', random_name())
		for i in range(10):
			Subject.objects.create(
				name=random_name(),
				email=random_name() + '@example.com',
				phone='',
				birthday=datetime.date.today(),
				gender=random.choice(GENDER_CHOICES)[0],
				field=random.choice(FIELD_CHOICES)[0])
		for i in range(2):
			experimenter = random.choice(User.objects.all())
			Experiment.objects.create(
				public_name=random_name(),
				private_name=random_name(),
				experimenter=experimenter)
		for i in range(5):
			Session.objects.create(
				time=random_date(),
				duration=Decimal(random.randint(1, 3) + random.random()).quantize(Decimal('0.1')),
				required_subjects=random.randint(6, 12),
				extra_subjects=random.randint(1, 5),
				experiment=random.choice(Experiment.objects.all()))
				
	def test_all(self):
		self.assertEqual(len(Subject.objects.all()), 20)
