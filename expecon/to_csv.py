import csv
import json

def build_header(o, parents=[]):
	header = []
	if type(o) == dict:
		for key, value in o.items():
			parents.append(key)
			header += build_header(value, parents=parents)
			parents.pop(-1)
	elif type(o) == list:
		for i in range(len(o)):
			header.append('.'.join(parents+[str(i)]))
	else:
		header.append('.'.join(parents))
	return header
	
def parse_config(o):
	configs = {}
	r = csv.reader(o.split('\n'))
	header = r.next()
	for line in r:
		config = {}
		for key, value in zip(header, line):
			if value == "TRUE":
				value = value.lower()
			elif value == "FALSE":
				value = value.lower()
			try:
				config[key] = json.loads(value)
			except ValueError:
				config[key] = value
		if 'period' not in config or 'group' not in config:
			continue
		period = config['period']
		group = config['group']
		if period not in configs:
			configs[period] = {}
		configs[period][group] = config
	return configs


def queue_to_csv(l):
	rows = []
	header =  ['Period', 'Group', 'Sender', 'Time', 'ClientTime', 'Key', 'Value']
	rows.append(header)
	groups = {}
	configs = {}
	for o in l:
		if o['Key'] == '__set_config__':
			configs = parse_config(o['Value'])
			o['Value'] = ''
		if o['Key'] == '__set_group__':
			groups[o['Sender']] = o['Value']['group']
		row = []
		period  = o['Period']
		if o['Sender'] in groups:
			group = groups[o['Sender']]
		else:
			group = 0
		for col in header:
			v = o
			if type(v) == dict and col in v:
				v = v[col]
			elif type(v) == dict and col not in v:
				v = ''
			elif type(v) == list:
				try:
					index = int(col)
				except ValueError:
					index = -1
				if index >= 0 and index < len(v):
					v = v[index]
				else:
					v = ''
			else:
				v = ''
			if type(v) == dict or type(v) == list:
				row.append(json.dumps(v))
			else:
				row.append(v)
		rows.append(row)
	return rows
