const { PineconeClient } = require("@pinecone-database/pinecone");
const { Configuration, OpenAIApi } = require("openai");
const readline = require('readline');
const fs = require('fs');

require('dotenv').config();
const open_ai_api_key = process.env.OPEN_API_KEY;
const text_embedding = 'text-embedding-ada-002'
const llm_model = 'gpt-3.5-turbo'
const pinecone_api_key = process.env.PINECONE_API_KEY;
const pinecone_index_name = 'llm-journal'
const pinecone_environment = 'asia-southeast1-gcp-free'
const journaling_url = 'prompt_templates/system_reflective_journaling.txt'

// Log into Pinecone
const pinecone = new PineconeClient();

function loadTextFile(relativePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(relativePath, 'utf8', (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

async function init_pinecone_index() {
    await pinecone.init({
    environment: pinecone_environment,
    apiKey: pinecone_api_key,
    })

    const indexesList = await pinecone.listIndexes();

    if (!indexesList.includes(pinecone_index_name)) {
        await pinecone.createIndex({
            createRequest: {
            name: pinecone_index_name,
            dimension: 1536,
            },
        });
    }
    return pinecone.Index(pinecone_index_name);
}

// Log into OpenAI API
const configuration = new Configuration({
  apiKey: open_ai_api_key,
});
const openai = new OpenAIApi(configuration);

async function calulate_embedding(message){
    var embedding_val = await openai.createEmbedding({
        model:text_embedding,
        input:message,
    });
    return embedding_val.data.data[0].embedding
}

async function update_pinecone_index(text){
    const index = await init_pinecone_index();
    var embedding_val = await calulate_embedding(text);

    const upsertRequest = {
      vectors: [
        {
          id: Math.random().toString(36),          
          values: embedding_val,
          metadata: {
            content: text,
          }
        }
      ],
    };

    const upsertResponse = await index.upsert({ upsertRequest });   
    
}

async function get_context(message){
    const index = await init_pinecone_index();
    var embedding_val = await calulate_embedding(message);
    var queryRequest = {
        vector: embedding_val,
        topK: 4,
        includeValues: true,
        includeMetadata: true,
      };
    var queryResponse = await index.query({ queryRequest });
    const contentArray = queryResponse.matches.map(match => match.metadata.content);
    const combinedString = contentArray.join('\n\n');
    return combinedString
}

async function send_user_message(message){
    const journaling_text = await loadTextFile(journaling_url)

    var user_context = await get_context(message)
    user_message = 'Context:\n' + user_context + '\n\n' + message  

    var completion = openai.createChatCompletion({
    model: llm_model,
    messages: [
        {role: "system", content: journaling_text},
        {role: "user", content: user_message}],
    });
    return completion;    
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getUserInput() {
  rl.question('Enter your message (or type "quit" to exit): ', async function (user_input) {
    if (user_input.toLowerCase() === 'quit') {
        rl.close();  // Close the readline interface to exit the program
    } else {
        let response = await send_user_message(user_input)
        user_string = `User: ${user_input}`
        response_string = `${response.data.choices[0].message.content}\n`
        // write message to file
        update_pinecone_index(user_string + `\n` + response_string)

        console.log(response_string);
        getUserInput();
    }
  });
}

getUserInput();