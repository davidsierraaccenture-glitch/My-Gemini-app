import { useState, useEffect } from 'react';
import { 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  LogOut, 
  MessageSquare, 
  Trash2, 
  Menu, 
  X,
  Sparkles,
  User as UserIcon
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { streamGeminiChatResponse } from './lib/gemini';
import Markdown from 'react-markdown';

interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: any;
  updatedAt: any;
}

interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!activeChatId || !user) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${activeChatId}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`);
    });

    return unsubscribe;
  }, [activeChatId, user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = () => signOut(auth);

  const createNewChat = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        title: 'New Conversation',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setActiveChatId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'chats', chatId));
      if (activeChatId === chatId) setActiveChatId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !activeChatId) return;

    const message = inputText;
    setInputText('');
    setIsTyping(true);

    try {
      // 1. Add user message
      await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        chatId: activeChatId,
        role: 'user',
        content: message,
        createdAt: serverTimestamp(),
      });

      // 2. Update chat title if it's the first message
      if (messages.length === 0) {
        await updateDoc(doc(db, 'chats', activeChatId), {
          title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
        });
      }

      // 3. Update chat timestamp
      await updateDoc(doc(db, 'chats', activeChatId), {
        updatedAt: serverTimestamp(),
      });

      // 4. Get Gemini response
      let fullResponse = '';
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const responseStream = streamGeminiChatResponse(message, history);

      // We'll create a placeholder for the model response and update it
      const modelMsgRef = await addDoc(collection(db, `chats/${activeChatId}/messages`), {
        chatId: activeChatId,
        role: 'model',
        content: '',
        createdAt: serverTimestamp(),
      });

      for await (const chunk of responseStream) {
        fullResponse += chunk;
        await updateDoc(doc(db, `chats/${activeChatId}/messages`, modelMsgRef.id), {
          content: fullResponse,
        });
      }

    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg text-blue-500">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles size={48} />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-brand-bg px-4 relative overflow-hidden">
        {/* Atmosphere */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-brand-card/40 backdrop-blur-2xl border border-white/10 p-10 rounded-[2rem] shadow-2xl relative z-10"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/20">
            <Sparkles size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 font-sans tracking-tight text-center">my gemini app</h1>
          <p className="text-gray-400 mb-10 text-sm text-center leading-relaxed">Secure, production-grade AI interface powered by Google Gemini and Firebase.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-blue-500 text-white py-4 px-6 rounded-2xl hover:bg-blue-600 transition-all font-bold cursor-pointer shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden font-sans text-brand-text">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            className="w-72 border-r border-white/5 flex flex-col bg-brand-sidebar"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3 font-semibold">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles size={20} className="text-white" />
                </div>
                <span className="tracking-tight text-sm font-bold uppercase text-gray-300">Console</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-gray-500 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <button 
                onClick={createNewChat}
                className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl transition-all font-bold text-sm shadow-lg shadow-blue-500/10 cursor-pointer"
              >
                <Plus size={18} />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 mt-4">
              <div className="px-3 mb-4 text-[10px] uppercase tracking-widest text-gray-600 font-bold">Recent History</div>
              {chats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full group text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${
                    activeChatId === chat.id 
                    ? 'bg-white/10 text-white border border-white/10 shadow-xl' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <MessageSquare size={16} className={`shrink-0 ${activeChatId === chat.id ? 'text-blue-400' : 'text-gray-600'}`} />
                  <span className={`truncate text-sm flex-1 ${activeChatId === chat.id ? 'font-semibold' : ''}`}>{chat.title}</span>
                  <button 
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-gray-600 hover:text-red-500 transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>

            <div className="p-4 mt-auto">
              <div className="p-4 bg-gradient-to-br from-blue-900/10 to-purple-900/10 rounded-2xl border border-blue-500/10 mb-4">
                <div className="text-[10px] font-black text-blue-400 mb-1 uppercase tracking-wider">Storage</div>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[20%]"></div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-400 to-rose-400 text-white flex items-center justify-center shrink-0 font-bold text-sm shadow-lg">
                    {user.displayName?.[0] || 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold truncate text-white">{user.displayName || 'Me'}</p>
                    <p className="text-[10px] text-gray-500 truncate tracking-tight">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-600/5 blur-[100px] rounded-full pointer-events-none"></div>

        <header className="h-20 border-b border-white/5 flex items-center px-8 justify-between bg-brand-nav/40 backdrop-blur-2xl sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-gray-400 hover:text-white"
              >
                <Menu size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-0.5">
                <span>Projects</span>
                <span>/</span>
                <span className="text-blue-400 font-medium">my gemini app</span>
              </div>
              <h2 className="font-bold text-lg tracking-tight truncate max-w-xs text-white">
                {activeChatId ? chats.find(c => c.id === activeChatId)?.title : 'Gemini AI Assistant'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center space-x-3 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-bold text-gray-400 hover:border-white/20 transition-colors">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/20"></div>
              <span className="uppercase tracking-widest">Spark Plan Active</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-400 to-rose-400 border border-white/20 p-0.5 shadow-xl">
               <div className="w-full h-full bg-brand-bg rounded-[9px] flex items-center justify-center font-bold text-xs text-white">
                 {user.displayName?.[0] || 'U'}
               </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 relative z-10 scrollbar-hide py-16">
          <div className="max-w-4xl mx-auto">
            {!activeChatId && (
              <div className="h-full flex flex-col items-center justify-center text-center py-32">
                <div className="w-28 h-28 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-[2.5rem] border border-blue-500/20 flex items-center justify-center mb-10 rotate-12 shadow-2xl shadow-blue-500/5">
                  <Sparkles size={56} className="text-blue-400" />
                </div>
                <h3 className="text-4xl font-black mb-4 tracking-tighter uppercase text-white">Intelligence System</h3>
                <p className="text-gray-500 max-w-sm text-sm font-mono tracking-tight leading-relaxed">Initialize a new dialogue thread to interface with the core intelligence unit.</p>
                <button 
                  onClick={createNewChat}
                  className="mt-10 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-3 text-white shadow-xl"
                >
                  <Plus size={20} />
                  New Project Interaction
                </button>
              </div>
            )}

            <div className="space-y-16">
              {messages.map((m, idx) => (
                <motion.div
                  key={m.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group flex gap-10"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-mono text-sm font-black shadow-2xl transition-transform group-hover:scale-105 ${
                    m.role === 'model' 
                    ? 'bg-blue-500 text-white shadow-blue-500/20' 
                    : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}>
                    {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    <div className="flex items-center gap-3 mb-6">
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${
                        m.role === 'model' 
                        ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' 
                        : 'text-gray-500 border-white/10'
                      }`}>
                        {m.role === 'model' ? 'Vertex_Intelligence' : 'User_Operator'}
                      </p>
                      <div className="h-px flex-1 bg-white/5"></div>
                      <p className="text-[10px] font-mono text-gray-600 uppercase">
                        {m.createdAt?.toDate ? new Date(m.createdAt.toDate()).toLocaleTimeString() : '...'}
                      </p>
                    </div>
                    <div className="prose prose-invert prose-blue prose-sm max-w-none text-gray-300 leading-relaxed font-sans text-lg selection:bg-blue-500/30">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <div className="flex gap-10 group">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-2xl animate-pulse">
                    <Sparkles size={24} />
                  </div>
                  <div className="flex-1 pt-2">
                    <div className="flex items-center gap-3 mb-6">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">
                        Synthesizing_Response
                      </p>
                      <div className="h-px flex-1 bg-white/5"></div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-3 bg-white/5 border border-white/5 rounded-full w-full animate-pulse"></div>
                      <div className="h-3 bg-white/5 border border-white/5 rounded-full w-11/12 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                      <div className="h-3 bg-white/5 border border-white/5 rounded-full w-10/12 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 lg:p-12 border-t border-white/5 bg-brand-nav/20 backdrop-blur-3xl shrink-0">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto relative group"
          >
            <div className="absolute -top-8 left-4 flex items-center gap-3">
               <div className={`w-2 h-2 rounded-full shadow-lg ${activeChatId ? 'bg-blue-500 shadow-blue-500/20' : 'bg-white/10'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                 {activeChatId ? 'Secure_Channel_Active' : 'Awaiting_Authentication'}
               </span>
            </div>
            
            <div className="relative flex items-center">
              <textarea
                rows={1}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={activeChatId ? "Enter request for Gemini..." : "Initialize session to enable gateway..."}
                disabled={!activeChatId || isTyping}
                className="w-full bg-[#0d121f]/60 border border-white/10 rounded-2xl py-6 pl-10 pr-40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all text-base font-sans text-white placeholder:text-gray-600 resize-none overflow-hidden h-20 min-h-[80px] shadow-2xl backdrop-blur-xl"
              />
              <div className="absolute right-4 flex items-center">
                <button 
                  type="submit"
                  disabled={!inputText.trim() || !activeChatId || isTyping}
                  className="bg-blue-500 text-white px-10 h-12 rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all font-black text-[11px] uppercase tracking-widest disabled:opacity-10 disabled:grayscale disabled:scale-100 cursor-pointer shadow-2xl shadow-blue-500/20"
                >
                  Execute
                </button>
              </div>
            </div>
          </form>
          
          <div className="mt-10 grid grid-cols-4 gap-8 opacity-40 select-none">
             <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
             <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
             <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
             <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.4em] text-gray-700 max-w-4xl mx-auto px-4">
             <span>Protocol_v4.2.0</span>
             <span>Network_Encrypted</span>
             <span>Identity_Verified</span>
             <span>Session_Bound</span>
          </div>
        </div>
      </main>
    </div>
  );
}
