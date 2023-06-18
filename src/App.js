import logo from './logo.svg';
import './App.css';
import React, { useRef, useState } from 'react';

import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/analytics';

import { getAuth, signInWithPopup, GoogleAuthProvider  } from "firebase/auth";
import { initializeApp} from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, getDocs, serverTimestamp , addDoc} from "firebase/firestore";
import {useAuthState} from 'react-firebase-hooks/auth';
import {useCollectionData} from 'react-firebase-hooks/firestore';

initializeApp({
  apiKey: "AIzaSyCcNEXKITqJWghfgMswPLmC2JG3ZlpfE7g",
  authDomain: "llm-journal-ff02f.firebaseapp.com",
  projectId: "llm-journal-ff02f",
  storageBucket: "llm-journal-ff02f.appspot.com",
  messagingSenderId: "951496233368",
  appId: "1:951496233368:web:da7fd2a54c1f6be10e1bed",
  measurementId: "G-LL8M17CV6D"
})

const authenticator = getAuth();
const db = getFirestore();

async function sendTextToApi(text) {
  const apiUrl = 'http://localhost:8080/api/ai_response';

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 'text': text })
    });

    const data = await response.json();
    // Handle the response data
    return data
  } catch (error) {
    // Handle the error
    console.error(error);
  }
}


function App() {
  const [user] = useAuthState(authenticator);
  return (
    <div className="App">
      <header className="App-header">
        <h1>Journal</h1>
        <SignOut/>
      </header>

      <section>
        {user ? <ChatRoom/> : <SignIn/>}
      </section>
    </div>
  );
}
function SignIn() {
  const useSignInWithGoogle = () =>{
    const provider = new GoogleAuthProvider();
    signInWithPopup(authenticator, provider);
  }
  return <button onClick = {useSignInWithGoogle}>Sign in with Google</button>
}
function SignOut() {
  return authenticator.currentUser && (
    <button onClick={() => authenticator.signOut()}>Sign Out</button>
  )
}
function ChatRoom() {
  const dummy = useRef()
  const messagesRef = collection(db, 'messages')
  const queryRef = query(messagesRef, orderBy('createdAt', 'asc'), limit(25));
  const [messages, loadingMessages, error] = useCollectionData(queryRef);//, { idField: 'id' });
  const [formValue, setFormValue] = useState('')
  
  
  const sendMessage = async(e) => {
    e.preventDefault();

    // Check if formValue is empty
    if (formValue.trim() === '') {
      return; // Stop execution if the formValue is empty
    }

    const {uid, photoURL} = authenticator.currentUser
    await addDoc(messagesRef,
      {
      text:formValue,
      createdAt: serverTimestamp(),
      uid,
      photoURL})
    setFormValue('')
    var response = await sendTextToApi(formValue)
    await addDoc(messagesRef,
      {
      text:response,
      createdAt: serverTimestamp(),
      uid:"AI"
    })
    dummy.current.scrollIntoView({behavior:'smooth'})
  }

  return (<>
    <main>
      <div>
        {messages && messages.map(msg => <ChatMessage key={msg.createdAt} message={msg} />)}
      </div>

      <div ref={dummy}></div>
    </main>

    <form onSubmit={sendMessage}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder='Submit a message'/>
        <button type="submit">Send 😎</button>
    </form>

  </>)
}


function ChatMessage(props) {
  const { text, uid, photoURL } = props.message;
  const messageClass = uid === authenticator.currentUser.uid ? 'sent' : 'received';
  return (<>
    <div className={`message ${messageClass}`}>
      <img src={photoURL || 'https://api.dicebear.com/6.x/bottts/svg?seed=Precious'} style={{ width: '100px', height: '100px' }}/>
      <p>{text}</p>
    </div>
  </>)
}

export default App;
