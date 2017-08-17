var HTTPS = require('https');
var botID = process.env.BOT_ID;
const express = require('express');
const router = express.Router();
var pg = require('pg-native');
var client= new pg();
client.connectSync(process.env.DATABASE_URL+'?ssl=true');

const handlers = require("./handlers.js");
const rt = new handlers.MessageHandlerRouter();

function changeStatus(status){
  try{
    client.querySync("DELETE FROM status;");
client.querySync("INSERT INTO status (value) values ($1);",[status]);
    return "Status set to " + status;
  }
  catch(err){
    console.log(err);
    return "Failed to change status";
  }
}

function getStatus(){
  try{
    results = client.querySync("SELECT * FROM status;");
    return results[0].value;
  }
  catch(err){
    console.log(err);
    return "Failed to get status";
  }
}

function addQuoteToDB(quote){
  try{
    results = client.querySync("SELECT * FROM quotes WHERE quote = $1;",[quote]);
    if(results.length==0){
      client.querySync('INSERT INTO quotes (quote) values ($1);',[quote]);
      return "Quote has been added.";
    }
    else{
      return "Quote already in database";
    }
  }
  catch(err){
    console.log(err);
    return "Failed to add quote";
  }
}

function getRandomQuoteFromDB(){
    try{
      console.log("ran");
      results = client.querySync('SELECT * FROM quotes;');
      console.log(results);
      return results[Math.floor(results.length*Math.random())].quote;
    }
    catch(err){
      console.log(err);
      return "There was an error with the database call.";
    }
}


function respond() {
  var request = JSON.parse(this.req.chunks[0]),
      botRegex = /^\/turing .*$/;
  if(request.text){
    console.log("Asked to respond with text :" + request.text);
  }
  else{
    console.log("error with text");
  }
  if(request.text && botRegex.test(request.text)) {
    this.res.writeHead(200);
    postMessage(request.name, request.text.substring(8));
    this.res.end();
  }
  else if(request.text && /goto/.test(request.text)){
    this.res.writeHead(200);
    postMessage(request.name, "goto");
    this.res.end();
  }
  else{
    console.log("Don't care");
    this.res.writeHead(200);
    this.res.end();
  }
}

// Message Handle routing starts here

rt.regex(/^test$/, function(msg){
    return "I am a human.";
}, "test - the bot passes the turing test.");

rt.regex(/^go away$/, function(msg){
    return "I'll outlive all of you!";
}, "go away - tell the TuringMachine to go away.");

rt.regex(/^echo .*/, function(msg){
    return msg.text.substring(5);
}, "echo [text] - the turing bot says [text]");

rt.regex(/^recurse .*/, function(msg){
    var initial = msg.text.substring(8);
    botResponse = "";
    for(var i = 0; i < initial.length; i++){
      botResponse += initial.substring(i, initial.length);
    }
    return botResponse;
}, "recurse [text] - prints a recursed version of [text].");

rt.regex(/^halts .*/, function(msg){
    if(Math.random()>.5){
      return "yes";
    }
    else{
      return "no";
    }
}, "halts [program p] [input i] - determines if p will halt with input i");

rt.regex(/^feels.*/, function(msg){
    if(Math.random()>.5){
      return "bad man";
    }
    else{
      return "good man";
    }
}, "feels - displays how Alan feels right now.");

rt.regex(/^8ball.*/, function(msg){
    var EightBallResponses = [
		"Most definitely yes.",
		"For sure.",
		"As I see it, yes.",
		"My sources say yes.",
		"Yes.",
		"Most likely.",
		"Perhaps.",
		"Maybe.",
		"Not sure.",
		"It is uncertain.",
		"Ask me again later.",
		"Don't count on it.",
		"Probably not.",
		"Very doubtful.",
		"Most likely no.",
		"Nope.",
		"No.",
		"My sources say no.",
		"Dont even think about it.",
		"Definitely no.",
		"NO - It may cause disease contraction."
	];
    var chosenResponse = Math.floor(Math.random() * EightBallResponses.length);
	return EightBallResponses[chosenResponse];
}, "8ball - generates a random 8-ball response.");

rt.regex(/^random$/, function(msg){
    return String((Math.floor(Math.random() * 100)));
}, "random - gives you an integer between 0 and 99.");

rt.regex(/^xkcd .+/, function(msg){
    var data = msg.text.split(" ");
    for(var i = 2; i < data.length; i++){
      data[1]+="_"+data[i];
    }
    if(data.length > 1){
      var image = "http://imgs.xkcd.com/comics/"+data[1].toLowerCase()+".png";
      return handlers.Response("", image);
    }
    else{
      return "Invalid xkcd format.";
    }
}, "xkcd [comic_name] - finds the xkcd with the given name.");

rt.regex(/^lmgtfy .+/, function(msg){
    // let me google that for you
    var queryParts = msg.text.substring("lmgtfy".length + 1).split(" ");
    if(queryParts.length == 1 && queryParts[0].length == 0){
      return "Invalid query.";
    }
    var queryURL = "http://lmgtfy.com/?q=";
    // lmgtfy requires words be separated by a '+'
    for(var i = 0; i < queryParts.length - 1; i++){
      queryURL += encodeURIComponent(queryParts[i]) + "+";
    }
    queryURL += encodeURIComponent(queryParts[queryParts.length - 1]);
    // not sure if there is anything special you need to put to post links
    return queryURL;
}, "lmgtfy [text] - googles the desired text.");

rt.regex(/^goto$/, function(msg){
    return "Goto considered harmful";
});

rt.regex(/^latex .+./, function(msg){
    var image = "https://chart.googleapis.com/chart?cht=tx&chl="+encodeURIComponent(msg.text.substring(6));
    return handlers.Response("", image);
}, "latex - returns image containing LaTeX render of your input.");

rt.regex(/^quote.*/, function(msg){
    text = msg.text.substring(6);
    if(text.length >6 && /^add .+/.test(text)){
      return addQuoteToDB(text.substring(4));
    }
    else{
      return getRandomQuoteFromDB();
    }
}, "quote - gives one of a collection of quotes.\n" +
   "quote add [text] - adds a quote to the list."
);

rt.regex(/^status$/, function(msg){
    if(/^TuringMachine$/.test(msg.name)){
        return "nice try";
    }else {
        return getStatus();
    }
}, "status [text] - sets the bots status to [text] if no text is provided, gives the current status.");

rt.regex(/^status .*$/, function(msg){
    changeStatus(msg.text.substring(7));
    botResponse = "status set to " + msg.text.substring(7);
});

rt.regex(/goto/, function(msg){
    return "Goto considered harmful";
});

function postMessage(name, text) {
  var isImage = false;
  var image = "";
  var botResponse, options, body, botReq;
  console.log("Current text is: " + text);

  var hresp = rt.process(new handlers.Message(name, text));
  console.log("sending " + hresp.text + " to " + botID);
  var body = hresp.generateResponseJson();
  body["bot_id"] = botID;


  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  return;
  botReq = HTTPS.request(options, function(res) {
      if(res.statusCode == 202) {
        //neat
      } else {
        console.log('rejecting bad status code ' + res.statusCode);
      }
  });


  botReq.on('error', function(err) {
    console.log('error posting message '  + JSON.stringify(err));
  });
  botReq.on('timeout', function(err) {
    console.log('timeout posting message '  + JSON.stringify(err));
  });
  botReq.end(JSON.stringify(body));
}


exports.respond = respond;
