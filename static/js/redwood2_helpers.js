// return the last element of the array
Array.prototype.last = function() {
	return this.length ? this[this.length - 1] : undefined;
};

// return the sum of the array
Array.prototype.sum = function() {
	var total = 0;
	this.forEach(function(value) {
		total += value;
	});
	return total;
};

Array.prototype.max = function() {
	return Math.max.apply(null, this)
};

Array.prototype.min = function() {
	return Math.min.apply(null, this)
};

// return the mean of the array
Array.prototype.mean = function() {
	return this.length ? this.sum() / this.length : undefined;
};

// run a Fischer-Yates shuffle on a collection
// e.g. [1, 2, 3, 4, 5].shuffle()
Array.prototype.shuffle = function(rng) {
	var result = angular.copy(this);
	if(rng === undefined) {
		rng = Math;
	}
	var i, j;
	for(i = 1; i < this.length; i++) {
		j = Math.floor(rng.random() * (i + 1));
		if(j !== i) {
			result[i] = this[j];
			result[j] = this[i];
		}
	}
	return result;
};

Object.size = function(object) {
	var count = 0;
	angular.forEach(object, function(prop) {
		count++;
	});
	return count;
};

var getPoisson = function(lambda) {
	var L = Math.exp(-lambda);
	var p = 1.0;
	var k = 0;

	do {
		k++;
		p *= Math.random();
	} while(p > L);

	return k - 1;
};

function require(script) {
	//this function checks to see if a required script was loaded or not
	return $.ajax({
		url: script,
		dataType: "script",
		async: false,
		error: function() {
			throw new Error("Could not load script " + script);
		}
	});
}

function isNullOrUndefined(obj) {
	return obj === null || obj === undefined;
}

var error_modal = "\
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
  </div>";

function tryParse(string) {
	var result = string;
	if(string.toLowerCase() === "true") {
		result = true;
	} else if(string.toLowerCase() === "false") {
		result = false;
	} else {
		try {
			var temp = JSON.parse(string);
			result = (isNullOrUndefined(temp) ? result : temp);
		} catch(SyntaxError) {
		}
	}
	return result;
}

(function($) {

	$.fn.get_val = function() {
		var v = this.val();
		if(this.attr("type") === "number" || this.attr("type") === "range") {
			v = parseInt(v);
			if(isNaN(v)) {
				return undefined;
			}
			if(this.attr("min") !== undefined && v < parseInt(this.attr("min"))) {
				return undefined;
			}
			if(this.attr("max") !== undefined && v > parseInt(this.attr("max"))) {
				return undefined;
			}
			if(this.attr("step") !== undefined && v % parseInt(this.attr("step")) !== 0) {
				return undefined;
			}
		}
		return v;
	};
})(jQuery);

$("[data-input]").each(function() {
	var widget = $(this);
	if(widget.closest("[data-form]").length === 0) {
		widget.change(function() {
			var v = widget.get_val();
			if(v !== undefined) {
				rw.send(widget.data("var"), v);
			} else {
				widget.addClass("error");
			}
		});
		rw.recv(widget.data("var"), function(msg) {
			if(widget.data("self") === false || msg.Sender === rw.user_id) {
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
			if(v !== undefined) {
				msg[widget.data("var")] = v;
				widget.removeClass("error");
			} else {
				widget.addClass("error");
			}
		});
		if(!form.find("[data-input]").hasClass("error")) {
			rw.send(form.data("var"), msg);
		}
		return false;
	});
	rw.recv(form.data("var"), function(msg) {
		if(form.data("self") === false || msg.Sender === rw.user_id) {
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
	if(fn !== undefined) {
		eval("fn = function(" + widget.data("var") + ") { return " + fn + "; }");
	}
	var fmt = widget.data("fmt");
	if(fmt !== undefined) {
		eval("fmt = function(v) { return " + fmt + "; }");
	}
	rw.recv(watch_key, function(msg) {
		if(widget.data("self") === false || msg.Sender === rw.user_id) {
			var v = msg.Value;
			if(fn !== undefined) {
				v = fn(v);
			}
			for(var i = 1; i < keys.length; i++) {
				v = v[keys[i]];
			}
			if(fmt !== undefined) {
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
	rw.recv(widget.data("var"), function(msg) {
		if(widget.data("self") === false || msg.Sender === rw.user_id) {
			history.push([history.length, msg.Value]);
			if(xrange !== undefined) {
				if(history.length - history[0][0] >= xrange) {
					opts.xaxis.min = history.length - xrange - 1;
					opts.xaxis.max = history.length - 1;
				}
			}
			if(!rw.__sync__.in_progress) {
				$.plot(widget, [history], opts);
			}
		}
	});
	rw.recv("__queue_end__", function() {
		$.plot(widget, [history], opts);
	});
});

$("[data-next-period]").each(function() {
	var widget = $(this);
	widget.attr("disabled", "disabled");
	rw.recv("period", function(msg) {
		if(widget.data("self") === false || msg.Sender === rw.user_id) {
			if(widget.data("auto") !== undefined) {
				setTimeout(function() {
					widget.prop("disabled", false);
					widget.click();
				}, parseInt(widget.data("auto")) * 1000);
			} else {
				widget.attr("disabled", null);
			}
		}
	});
	widget.click(function() {
		widget.attr("disabled", "disabled");
		rw.send("data_next_period_clicked");
		return false;
	});
	rw.recv("data_next_period_clicked", function(msg) {
		if(msg.Sender === rw.user_id) {
			widget.attr("disabled", "disabled");
			rw.on_group_synced(function() {
				rw.set_period(rw.period + 1);
			});
		}
	});
});

$("[data-load-config]").each(function() {
	$(this).
		attr("accept", "text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").
		change(function(event) {
			if(event.target.files.length === 1) {
				var filename = event.target.files[0];
				var reader = new FileReader();
				reader.onload = (function(f) {
					return function(e) {
						rw.set_config(e.target.result);
					};
				})(filename);
				reader.readAsText(filename);
			}
			return false;
		});
});