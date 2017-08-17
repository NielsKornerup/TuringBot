/**
 * Creates a new Message
 * @param       {string} name - The username of the person sending the message
 * @param       {string} text - The message that the user sent
 * @constructor
 */
function Message(name, text) {
    /**
     * The username of the person sending the message
     * @type {string}
     */
    this.name = name;
    /**
     * The message that the user sent
     * @type {string}
     */
    this.text = text;
}

/**
 * Creates a new Response
 * @param       {string} text - Message to send back as bot
 * @param       {string} imageUrl - Optional URL to an image to attach to message
 * @constructor
 */
function Response(text, imageUrl) {
    /**
     * Message to send back as bot
     * @type {string}
     */
    this.text = text;
    /**
     * Optional URL to an image to attach to message
     *
     * If one is not provided, the message is simply plain-text
     * @type {string}
     */
    this.imageUrl = imageUrl;

    /**
     * Returns a JSON object representing this response
     *
     * It is pretty much in the format to be sent to the GroupMe API,
     * except you need to the "bot_id" property
     * @return {Object} JSON representation of message
     */
    this.generateResponseJson = function() {
        response = {
            "text": this.text
        };
        if (this.imageUrl) {
            response["attachments"] = [{
                "type": "image",
                "url": this.imageUrl
            }]
        }
        return response;
    }
}

/**
 * Creates a MessageHandler
 *
 * These are based off of the "routes" in the Flask Python framework.
 * The way they should be used is supplying a function for checking whether they want to consume the given message
 * and if they want to consume it, the responder will consume it and generate a response.
 *
 * @param       {function(Message):boolean} checker - Evaluates if the handler should handle the supplied Message
 * @param       {function(Message):Response} responder - Constructs a response to the supplied message
 * @param       {string} help - Optional help text to display with this handler
 * @constructor
 */
function MessageHandler(checker, responder, help) {
    /**
     * Evaluates if the handler should handle the supplied Message
     * @param {Message} message - Message to check against
     * @return {boolean} - True if the handler should handle the message
     */
    this.checker = checker;
    /**
     * Constructs a response to the supplied message
     * @param {Message} message - Message to create the response data from
     * @return {(Response|string)} - Response to message, either as a Response object or a string that can then be converted to a response
     */
    this.responder = responder;
    /**
     * Optional help text to display with this handler
     * @type {string}
     */
    this.help = help;
}

/**
 * Creates a MessageHandlerRouter
 *
 * This is basically a collection of MessageHandlers and should be the main usage point.
 * You should really only have one of these per application.
 *
 * @constructor
 */
function MessageHandlerRouter(){
    var thisrouter = this;
    /**
     * Internal collection of handlers to check against.
     * Order matters! Earlier handlers have first dibs on consumption.
     * @type {MessageHandler[]}
     */
    this.handlers = [];

    /**
     * Built-in "help" handler that responds with a list of usages for the other handlers
     * @type {MessageHandler}
     */
    this.helpHandler = new MessageHandler(
        function(message){return /^help/.test(message.text);},
        function(message){
            var help_messages = thisrouter.handlers.filter(function(handler){
                return handler.help;
            }).map(function(handler){return handler.help;});
            return "Current valid commands are:\n" + help_messages.join("\n");
        }
    );
    /**
     * Built-in default handler for always choosing to consume and provides a catch-all response.
     * This should always be the last handler; if not, the following handlers will not be run.
     * @type {MessageHandler}
     */
    this.defaultHandler = new MessageHandler(
        function(message){return true;},
        function(message){
            return "Invalid command. Type /turing help for a list of valid commands.";
        }
    );

    /**
     * Adds a handler to the end of current handlers
     * @param  {MessageHandler} messageHandler - handler to add to this router
     */
    this.addHandler = function(messageHandler){
        this.handlers.push(messageHandler);
    };

    /**
     * Creates and adds a handler to this Router that accepts messages that match the supplied regular expression
     *
     * Usage: router.regex(/^test/, function(msg){
     *            return "I am a human.";
     *        }, "test - the bot passes the turing test.");
     *
     * @param  {RegExp} reg_exp - Regular expression to test the message text against
     * @param  {function(Message):Response} responder [description]
     * @param  {string} help - optional help text for the handler
     */
    this.regex = function(reg_exp, responder, help){
        this.addHandler(new MessageHandler(
            function(message){return reg_exp.test(message.text);},
            responder,
            help
        ));
    };

    /**
     * Produces a Response from the given Message by calling the responder of the first matching MessageHandler.
     * @param  {Message} message - message to consume
     * @return {Response} - response returned from the matching handler
     */
    this.process = function(message){
        var hdls = this.handlers.slice();
        hdls.push(this.helpHandler);
        hdls.push(this.defaultHandler);
        for(var i = 0; i < hdls.length; i++){
            var handler = hdls[i];
            if(handler.checker(message)){
                var response = handler.responder(message);
                if(typeof response == "string" || response instanceof String){
                    response = new Response(response);
                }
                return response;
            }
        }
        // should never reach this point because of the defaultHandler
    };
}

module.exports = {
    Message: Message,
    Response: Response,
    MessageHandler: MessageHandler,
    MessageHandlerRouter: MessageHandlerRouter
}
