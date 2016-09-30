var HTTPS = require('https');

var botID = process.env.BOT_ID;

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
    postMessage(request.text.substring(8));
    this.res.end();
  } else {
    console.log("don't care");
    this.res.writeHead(200);
    this.res.end();
  }
}

function postMessage(text) {
  var botResponse, options, body, botReq;
  console.log("Current text is: " + text);
  if(/^help/.test(text)){
     botResponse = "current valid commands are: \n test - the bot passes the turing test. \n echo [text] - the turing bot says [text] \n tell [person] [text]. Tells [person] [text]. \n halts [program p] [input i] - determines if p will halt with input i \n help - displays this information.";
  }
  else if(/^test$/.test(text)){
     botResponse = "I am a human.";
  }
  else if(/^echo .*/.test(text)){
    botResponse = text.substring(5);
  }
  else if(/^tell .*/.test(text)){
    var sentence = text.split(" ");
    if(sentence.length >= 3){
      botResponse = "@"+sentence[1] + " ";
      for(var i = 2; i < sentence.length -1; i++){
         botResponse+= sentence[i] + " ";
      }
      botResponse+=sentence[sentence.length-1];
    }
    else{
      botResponse = "Invalid command. Type /turing help for a list of valid commands.";
    }
    
  }
  else if(/^halts .*/){
    if(Math.random()>.5){
      botResponse = "yes";
    }
    else{
      botResponse = "no";
    }
  }
  else{
     botResponse = "Invalid command. Type /turing help for a list of valid commands.";
  }

  options = {
    hostname: 'api.groupme.com',
    path: '/v3/bots/post',
    method: 'POST'
  };

  body = {
    "bot_id" : botID,
    "text" : botResponse
  };

  console.log('sending ' + botResponse + ' to ' + botID);

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
