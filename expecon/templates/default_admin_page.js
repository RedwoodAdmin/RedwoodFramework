{% load verbatim %}{% verbatim %}function setupGroups(groupSize) {
  if (Object.size(r.subjects) === 0 || Object.size(r.subjects) % groupSize !== 0) {
    return;
  }
  var group = Object.size(r.groups) + 2;
  var lastGroupSize = 0;
  var i;
  for (i =0; i < r.subjects.length; i++) {
    if (r.groups[r.subjects[i]] == group - 1) {
      lastGroupSize++;
    }
  }
  if (lastGroupSize < groupSize) {
    group--;
  }
  var count = 0;
  for (i = 0; i < r.subjects.length; i++) {
    var subject = r.subjects[i];
    if (!(subject in r.groups)) {
      r.set_group(group, subject);
      count++;
      if (count == groupSize) {
        count = 0;
        group++;
      }
    }
  }
}

var session_started = false;
$(function() {
  
  $("#start-session").click(function() {
    $.ajaxSetup({async:false});
    for (var i = 0; i < r.subjects.length; i++) { 
      var period = r.periods[r.subjects[i]];
      if (period === undefined) {
        period = 0;
      }
      r.set_period(period+1, r.subjects[i]);
    }
    return false;
  });
  
  $("#reset-session").click(function() {
    r.send("__reset__");
    return false;
  });
  
  $("#regroup").click(function() {
    var groupsize = parseInt($("#groupsize").val(), 10);
    setupGroups(groupsize);
    r.send("groupsize", groupsize);
  });
  
  $("#archive").click(function() {
    $.post("admin/archive");
    r.send("__delete__");
    return false;
  });
  
  r.recv("__router_status__", function(msg) {
    var status = $("#router-status");
    if (r.ws.readyState === WebSocket.OPEN) {
      status.text("Router: Connected");
      status.removeClass("badge-important");
      status.addClass("badge-success");
    } else {
      status.text("Router: Disconnected");
      status.removeClass("badge-success");
      status.addClass("badge-important");
    }
  });
  
  r.recv("groupsize", function(msg) {
    $("#groupsize").val(msg.Value);
  });
  
  r.recv("__set_period__", function(msg) {
    $("#start-session").attr("disabled", "disabled");
    $("#groupsize").attr("disabled", "disabled");
    $("#regroup").attr("disabled", "disabled");
    session_started = true;
    $("tr.subject-"+msg.Sender+" :nth-child(3)").text(msg.Value.period);
  });
  
  r.recv("__set_group__", function(msg) {
    $("tr.subject-"+msg.Sender+" :nth-child(2)").text(msg.Value.group);
  });
  
  r.recv("__register__", function(msg) {
    $("#subject-list").append($("<tr>").addClass("subject-"+msg.Sender).append(
      $("<td>").text(msg.Sender).after(
      $("<td>").text(0).after(
      $("<td>").text(0)))));
  });
  
  r.recv("__set_config__", function(msg) {
    var a = $.csv.toArrays(msg.Value);
    for (var i = 0; i < a.length; i++) {
      var row = a[i];
      var tr = $("<tr>");
      for (var j = 0; j < row.length; j++) {
        var cell = row[j];
        var td = $("<td>").text(cell);
        tr.append(td);
      }
      $("table.config").append(tr);
    }
  });
  
  $.ajaxSetup({
    beforeSend: function(xhr, settings) {
      xhr.setRequestHeader("X-CSRFToken", $.cookie("csrftoken"));
  }});
});{% endverbatim %}
