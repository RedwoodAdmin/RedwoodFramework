/*
	Notes on commenting:
		- place comments before the function definition
		- write the comment from the perspective of a programmer intending to use
		  the function, e.g. "set the current page for the given user_id",
		  "returns the current period"
*/

// temporary fix to get rid of Jquery throwing warning messages in WebKit.
(function(){
	// remove layerX and layerY
	var all = $.event.props,
		len = all.length,
		res = [];
	while (len--) {
		var el = all[len];
		if (el != 'layerX' && el != 'layerY') res.push(el);
	}
	$.event.props = res;
}());

Object.sanitizeHTML = function(cleanMe) {
	var toScrutinize = $(cleanMe).find('*'); //get ALL elements
	$(cleanMe).find('script').remove(); // take out any inline scripts
	$.each(toScrutinize, function() {
		var attr = $(this)[0].attributes; // get all the attributes
		var that = $(this); 
		$.each(attr, function(){
			if ($(that).attr(this.nodeName).match(/^http/)) { // if the attribute value links externally
				$(that).remove(); // ...take it out  
			}
		});
	})
}

Object.size = function(obj) {
	// returns the number of elements in the given object
  var size = 0, key;
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
}

// return the sum of the array
Array.prototype.sum = function() {
  var total = 0;
  for (var i = 0; i < this.length; i++) {
  	total += this[i];
  }
  return total;
}

// return the mean of the array
Array.prototype.mean = function() {
  return this.sum() / this.length;
}

// run a Fischer-Yates shuffle on a collection
// e.g. [1, 2, 3, 4, 5].shuffle()
Array.prototype.shuffle = function(rng) {
	if (rng === undefined) {
		rng = Math;
	}
	var i, j, tmp;
	for (i = 1; i < this.length; i++) {
		j = Math.floor(rng.random()*(i+1));
		if (j !== i) {
			tmp = this[i];
			this[i] = this[j];
			this[j] = tmp;
		}
	}
	return this;
}

function require(script) {
//this function checks to see if a required script was loaded or not
	return $.ajax({
	  url: script,
	  dataType: "script",
		async: false,
	  error: function () {
	  	throw new Error("Could not load script " + script);
	  }
	});
}

function Redwood(options) {
	var r = this; //set r to new instance of redwood
	var components = window.location.pathname.split("/");
	//check to see which path we're on and set the user_ids and path accordingly
	var component_index;
	if (components[1] === "session") {
		// example url: /session/1/admin, /session/1/subject/1
		r.instance = "";
		component_index = 2;
	} else {
		// example url: /redwood/session/1/admin, /redwood/session/1/subject/1
		r.instance = "/" + components[1];
		component_index = 3;
	}
	r.session = parseInt(components[component_index], 10);
	if (components[component_index+1] === "admin") {
		if (component_index+2 < components.length) {
			r.user_id = "listener";
		} else {
			r.user_id = "admin";
		}
	} else {
		r.user_id = decodeURIComponent(components[component_index+2]);
	}

	require(r.instance + '/static/js/random.js');
	require(r.instance + '/static/js/bootstrap.js');
	require(r.instance + '/static/js/bootstrap-modal.js');
	require(r.instance + '/static/js/domparser.js');
	require(r.instance + '/static/js/jquery.csv-0.7.min.js');
	
	// not public...
	r.__listeners__ = {};
	
	// public
	r.config = {};
	r.configs = [];
	
	r.__connect__ = function() {
	
		var host = window.location.hostname;
		var port = 8080;
		if (r.instance === "") {
			var url = "ws://" + host + ":" + port + "/" +  r.session + "/" + r.user_id;
		} else {
			var url = "ws://" + host + ":" + port + r.instance + "/" + r.session + "/" + r.user_id;
		}

		// not public
		r.ws = new WebSocket(url);
		//websockets communicate with the user to gather input and provide output
		r.ws.onopen = function() {
			
			// public
			r.subjects = [];
			r.group = undefined;
			r.period = undefined;
			r.page = undefined;
			r.points = 0;
			r.groups = {};
			r.periods = {};
			r.period_points = {};
			r.pages = {};
			r.queue = [];
			r.time_delta = 0;
			
			r.__sync__ = {in_progress: false};
			r.send = r.__default_send__;
			r.__broadcast__({
				Key: "__router_status__"
			});
			
			$("#redwood-error").modal("hide");
		}
	
		r.ws.onerror = function(e) {
			r.send = r.__error_send__;
			r.__broadcast__({
				Key: "__router_status__",
				Value: e
			});
		} // throw an error if a connection to the router can't be established
	
		r.ws.onclose = function(e) {
			$("body").append(r.error_modal);
			if ($("#redwood-error").css("display") === "none") {
				$("#redwood-error").modal();
			}
			r.send = r.__error_send__;
			r.__broadcast__({
				Key: "__router_status__",
				Value: e
			});
			r.__retry_connect__(10);
		}

		r.ws.onmessage = function(ws_msg) {
			var msg = JSON.parse(ws_msg.data);
			if (msg.Key === "__queue_start__") {
				r.__nonce__ = msg.Nonce;
				r.__sync__.in_progress = true;
				r.__sync__.send = r.send;
				r.send = function() {};
			} else if (msg.Key === "__queue_end__") {
				r.__sync__.in_progress = false;
				r.send = r.__sync__.send;
			}
			r.__handle_msg__(msg);
		}
	}; // goes through the queue of set pages until the most recent page is loaded
	
	r.__retry_connect__ = function(t) {
		$("#connection-retry").text(t);
		if (t === 0) {
			r.__connect__();
		} else {
			setTimeout(function() {
				r.__retry_connect__(t - 1);
			}, 1000);
		}
	}; // attempts to retry the connection if it times out
	
	r.__default_send__ = function(key, value, args) {
		if (args === undefined) {
			args = {};
		}
		if (!('period' in args)) {
			args.period = r.period;
		}
		if (!('group' in args)) {
			args.group = r.group;
		}
		var msg = {
			Session: r.session,
			Nonce: r.__nonce__,
			Period: args.period,
			Group: args.group,
			Sender: args.sender,
			StateUpdate: args.state_update,
			Key: key,
			Value: value,
			ClientTime: new Date().getTime()
		};
		r.ws.send(JSON.stringify(msg));
		return msg;
	};
	
	r.__error_send__ = function(key, value, group, period) {};
	
	r.send = r.__error_send__;
	
	// call function f when a message with the given key is received
	r.recv = function(key, f) {
		if (!(key in r.__listeners__)) {
			r.__listeners__[key] = [];
		}
		r.__listeners__[key].push(f);
	};
	
	r.unbind = function(key, listener) {
		var i = r.__listeners__[key].indexOf(listener);
		r.__listeners__[key].splice(i, 1);
	};
	
	r.finish_sync = function(f) {
		r.recv("__queue_end__", f);
	};
	
	// set the current config using given data in csv or xls format
	r.set_config = function(config) {
		r.send("__set_config__", config, { state_update: true }); 
	}
	
	// set a new period for a specified user_id
	r.set_period = function(period, user_id) {
		r.send("__set_period__", { period: period }, { sender: user_id, state_update: true });
	}
	
 	// set a new group for a specififed user_id
	r.set_group = function(group, user_id) {
		r.send("__set_group__", { group: group }, { sender: user_id, state_update: true });
	}
	
	// set a new page for a specified user_id
	r.set_page = function(page, user_id) {
		r.send("__set_page__", { page: page }, { sender: user_id, state_update: true });
	}
	
	// set the points for a specified user_id in a specified period
	// check if state_update can be used to reduce number of __set_points__ messages
	r.set_points = function(points, period, user_id) {
		if (period === undefined) {
			period = r.period;
		}
		r.send("__set_points__", { period: period, points: parseFloat(points) }, { sender: user_id });
	}
	
	r.add_points = function(points, period, user_id) {
		if (period === undefined) {
			period = r.period;
		}
		if (user_id === undefined) {
			user_id = r.user_id;
		}
		var curr_points = 0;
		if (r.period_points[period] !== undefined && r.period_points[period][user_id] !== undefined) {
			curr_points = r.period_points[period][user_id];
		}
		r.send("__set_points__", { period: period, points: curr_points + parseFloat(points) }, { sender: user_id });
	}
	
	//set the amount paid for a specified user_id in a specified period
	r.mark_paid = function(paid, period, user_id) {
		if (period === undefined) {
			period = r.period;
		}
		r.send("__mark_paid__", { period: period, paid: paid }, { sender: user_id });
	};
	
	r.set_conversion_rate = function(conversion_rate, user_id) {
		r.send("__set_conversion_rate__", { conversion_rate: conversion_rate }, { sender: user_id });
	};
	
	r.set_show_up_fee = function(show_up_fee, user_id) {
		r.send("__set_show_up_fee__", { show_up_fee: show_up_fee }, { sender: user_id });
	};
	
	// retrieve (possibly old) period data
	r.get_period = function(period, callback) {
		r.recv('__get_period__', function(msg) {
			callback(msg);
			r.unbind('__get_period__', this);
		});
		r.send('__get_period__', { period: period });
	};
	
	// bypass cross-site security and retrieve a page from another domain 
	r.get_outside_page = function(url) {
		var htmlstring;
		$.ajax(r.instance + '/session/' + r.session + '/get_outside_page', {
			data: { 'url': url },
			success: function(data) {
				htmlstring = data;
			}
		});
		
		var parser = new DOMParser();
    var dom = parser.parseFromString(htmlstring, "text/html");
		return $(dom);
	}
	
	r.__broadcast__ = function(msg) {
		if (msg.Key in r.__listeners__) {
			for (var i = 0; i < r.__listeners__[msg.Key].length; i++) {
				r.__listeners__[msg.Key][i](msg);
			}
		}
		if ("*" in r.__listeners__) {
			for (var i = 0; i < r.__listeners__["*"].length; i++) {
				r.__listeners__["*"][i](msg);
			}
		}
	};

	r.__handle_msg__ = function(msg) {
	
		if (!r.__sync__.in_progress &&
			(msg.Key === "__reset__" ||
			 msg.Key === "__delete__" ||
			(msg.Key === "__set_period__" && msg.Sender === r.user_id) ||
		  (msg.Key === "__set_page__" && msg.Sender === r.user_id))) {
			window.location.reload(true);
		}
		
		if (msg.Key == "__error__") {
			$("body").append($("<div>").addClass("container").html(msg.Value));
		}

		if (!r.__sync__.in_progress) {
			var delta = new Date().getTime() - (msg.Time / 1e6);
			if (r.time_delta === 0) {
				r.time_delta = delta;
			} else {
				r.time_delta += 0.1 * (delta - r.time_delta);
			}
		}

		if (msg.Key === "__set_config__") {
			r.configs = $.csv.toObjects(msg.Value);
			var max_period;
			for (var i = 0; i < r.configs.length; i++) {
				for (var j in r.configs[i]) {
					if (typeof(r.configs[i][j]) === "string") {
						var v = r.configs[i][j];
						if (v.toLowerCase() === "true") {
							v = true;
						} else if (v.toLowerCase() === "false") {
							v = false;
						} else {
							try {
								v = JSON.parse(v);
							} catch (SyntaxError) {
							}
						}
						r.configs[i][j] = v;
					}
				}
			}
		} else if (msg.Key === "__set_period__") {
			r.periods[msg.Sender] = msg.Value.period;
			if (msg.Sender === r.user_id) {
				r.period = msg.Value.period;
				r.config = {};
				for (var i = 0; i < r.configs.length; i++) {
					var config = r.configs[i];
					if (config.period === msg.Value.period) {
						if (config.group === 0 || config.group === r.group) {
							r.config = config;
						}
					}
				}
				if (Object.size(r.config) === 0) {
					r.set_page("Finish");
				} else {
					r.set_page("Start");
				}
			}
		} else if (msg.Key === "__set_group__") {
			r.groups[msg.Sender] = msg.Value.group;
			if (msg.Sender === r.user_id) {
				r.group = msg.Value.group;
			} //this updates the group if the group has been set
		} else if (msg.Key === "__set_page__") {
			r.pages[msg.Sender] = msg.Value.page;
			if (msg.Sender === r.user_id) {
				r.page = msg.Value.page;
			} //this changes the page when the message gets recieved
		} else if (msg.Key === "__set_points__") {
			if (r.period_points[msg.Value.period] === undefined) {
				r.period_points[msg.Value.period] = {};
			}
			r.period_points[msg.Value.period][msg.Sender] = msg.Value.points;
			if (msg.Sender === r.user_id && msg.Value.period === r.period) {
				r.points = msg.Value.points;
			}
		} else if (msg.Key === "__register__") {
			r.subjects.push(msg.Sender);
		}
		r.queue.push(msg);
		r.__broadcast__(msg);
	}
	
	r.error_modal = "\
	<div id='redwood-error' class='modal fade hide'>\
		<div class='modal-header'>\
    	<button class='close' data-dismiss='modal'>×</button>\
    	<h3>Problem Connecting to Redwood</h3>\
  	</div>\
  	<div class='modal-body'>\
    	<p>\
    		Unable to connect to the redwood message router. Either the router\
    		is down, or a firewall is preventing the connection.\
    	</p>\
  	</div>\
  	<div class='modal-footer'>\
  		<p>Retrying connection in <span id='connection-retry'</span></p>\
    	<a href='' class='btn' data-dismiss='modal'>Close</a>\
  	</div>\
  </div>"
	$("head").append('<link type="text/css" rel="stylesheet" href="' + r.instance + '/static/css/bootstrap.css"></link>');

	r.__connect__();

	(function($){

		$.fn.get_val = function() {
			var v = this.val();
			if (this.attr("type") === "number" || this.attr("type") === "range") {
				v = parseInt(v, 10);
				if (isNaN(v)) {
					return undefined;
				}
				if (this.attr("min") !== undefined && v < parseInt(this.attr("min"), 10)) {
					return undefined;
				}
				if (this.attr("max") !== undefined && v > parseInt(this.attr("max"), 10)) {
					return undefined;
				}
				if (this.attr("step") !== undefined && v % parseInt(this.attr("step"), 10) !== 0) {
					return undefined;
				}
			}
			return v;
		};
	})( jQuery );

	$("[data-input]").each(function() {
		var widget = $(this);
		if (widget.closest("[data-form]").length === 0) {
			widget.change(function() {
				var v = widget.get_val();
				if (v !== undefined) {
					r.send(widget.data("var"), v);
				} else {
					widget.addClass("error");
				}
			});
			r.recv(widget.data("var"), function(msg) {
				if (widget.data("self") === false || msg.Sender === r.user_id) {
					widget.val(msg.Value);
				}
			});
		}
	});

	$("[data-form]").each(function() {
		var form = $(this);
		form.find("[data-submit]").click(function() {
			var msg = {};
			form.find("[data-input]").each(function() {
				var widget = $(this);
				var v = widget.get_val();
				if (v !== undefined) {
					msg[widget.data("var")] = v;
					widget.removeClass("error");
				} else {
					widget.addClass("error");
				}
			});
			if (!form.find("[data-input]").hasClass("error")) {
				r.send(form.data("var"), msg);
			}
			return false;
		});
		r.recv(form.data("var"), function(msg) {
			if (form.data("self") === false || msg.Sender === r.user_id) {
				form.find("[data-input]").each(function() {
					var widget = $(this);
					widget.val(msg.Value[widget.data("var")]);
					widget.attr("disabled", "disabled");
				});
				form.find("[data-submit]").attr("disabled", "disabled");
			}
		});
	});

	$("span[data-output]").each(function() {
		var widget = $(this);
		var keys = widget.data("var").split(".");
		var watch_key = keys[0];
		var fn = widget.data("fn");
		if (fn !== undefined) {
			eval("fn = function(" + widget.data("var") + ") { return " + fn + "; }");
		}
		var fmt = widget.data("fmt");
		if (fmt !== undefined) {
			eval("fmt = function(v) { return " + fmt + "; }");
		}
		r.recv(watch_key, function(msg) {
			if (widget.data("self") === false || msg.Sender === r.user_id) {
				var v = msg.Value;
				if (fn !== undefined) {
					v = fn(v);
				}
				for (var i = 1; i < keys.length; i++) {
					v = v[keys[i]];
				}
				if (fmt !== undefined) {
					v = fmt(v);
				}
				widget.text(v);
			}
		});
	});

	$("[data-history]").each(function() {
		var widget = $(this);
		var history = [];
		var opts = {
			xaxis: {
				min: null,
				max: null
			}
		};
		var xrange = widget.data("xrange");
		r.recv(widget.data("var"), function(msg) {
			if (widget.data("self") === false || msg.Sender === r.user_id) {
				history.push([history.length, msg.Value]);
				if (xrange !== undefined) {
					if (history.length - history[0][0] >= xrange) {
						opts.xaxis.min = history.length - xrange - 1;
						opts.xaxis.max = history.length - 1;
					}
				}
				if (!r.__sync__.in_progress) {
					$.plot(widget, [history], opts);
				}
			}
		});
		r.recv("__queue_end__", function() {
			$.plot(widget, [history], opts);
		});
	});

	$("[data-next-period]").each(function() {
		var widget = $(this);
		widget.attr("disabled", "disabled");
		widget.click(function() {
			r.set_period(r.period+1);
			return false;
		});
		r.recv("period", function(msg) {
			if (widget.data("self") === false || msg.Sender === r.user_id) {
				widget.attr("disabled", null);
			}
		});
	});
	
	$("[data-load-config]").each(function() {
		$(this).
		attr("accept", "text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").
		change(function(event) {
		  if (event.target.files.length === 1) {
		    var filename = event.target.files[0];
		    var reader = new FileReader();
		    reader.onload = (function(f) {
		      return function(e) {
		        r.set_config(e.target.result);
		      };
		    })(filename);
		    reader.readAsText(filename);
		  }
		  return false;
  	});
	});

	var update_config_data = function(msg) {
		$("[data-config]").each(function() {
			var widget = $(this);
			widget.text(r.config[widget.data("config")]);
		});
	}
	r.finish_sync(update_config_data);
	r.recv("__set_config__", update_config_data);
}

$(function() {
	r = new Redwood();
});
