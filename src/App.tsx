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
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  getDocs,
  limit,
  where
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  LogOut, 
  Search, 
  X,
  Sparkles,
  Smartphone,
  Watch,
  Headphones,
  Laptop as LaptopIcon,
  ShoppingCart,
  ChevronRight,
  TrendingUp,
  Cpu,
  Monitor
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryId: string;
  imageUrl: string;
  stock: number;
  featured?: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

const CATEGORIES = [
  { id: 'phones', name: 'Phones', icon: Smartphone },
  { id: 'laptops', name: 'Laptops', icon: LaptopIcon },
  { id: 'audio', name: 'Audio', icon: Headphones },
  { id: 'watches', name: 'Watches', icon: Watch },
  { id: 'monitors', name: 'Displays', icon: Monitor },
  { id: 'components', name: 'Components', icon: Cpu },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let q = query(collection(db, 'products'), orderBy('price', 'desc'), limit(20));
    
    if (selectedCategory) {
      q = query(collection(db, 'products'), where('categoryId', '==', selectedCategory), limit(20));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productList);

      // Seed sample data if empty
      if (productList.length === 0) {
        seedSampleProducts();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return unsubscribe;
  }, [selectedCategory]);

  const seedSampleProducts = async () => {
    const samples = [
      { name: 'Nebula X1 Pro', description: 'Next-gen flagship smartphone with 8K display.', price: 1099, categoryId: 'phones', imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&q=80&w=800', stock: 15, featured: true },
      { name: 'Horizon Book Pro', description: 'Carbon-fiber laptop with 32GB RAM.', price: 2499, categoryId: 'laptops', imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800', stock: 8, featured: true },
      { name: 'Echo Buds Ultra', description: 'Lossless audio wireless earbuds.', price: 299, categoryId: 'audio', imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800', stock: 50 },
      { name: 'Stellar Watch S4', description: 'Sapphire glass smartwatch with heart rate sync.', price: 499, categoryId: 'watches', imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800', stock: 25 },
      { name: 'Vortex 4K Curved', description: 'Bezel-less 144Hz gaming monitor.', price: 899, categoryId: 'monitors', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&q=80&w=800', stock: 12 },
    ];

    for (const p of samples) {
      await addDoc(collection(db, 'products'), p);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return;
    }

    setCheckoutLoading(true);
    try {
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        total: totalPrice,
        status: 'pending',
        createdAt: serverTimestamp(),
        items: cart.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity }))
      });
      setCart([]);
      setCheckoutSuccess(true);
      setTimeout(() => {
        setIsCartOpen(false);
        setCheckoutSuccess(false);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-brand-bg text-blue-500">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Sparkles size={48} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-brand-bg overflow-hidden font-sans text-brand-text">
      {/* Sidebar - Desktop Navigation */}
      <aside className="w-64 border-r border-white/5 flex flex-col bg-brand-sidebar hidden lg:flex">
        <div className="p-8 pb-12">
          <div className="flex items-center gap-3 font-semibold mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShoppingBag size={24} className="text-white" />
            </div>
            <span className="tracking-tight text-xl font-black uppercase text-white">Quantum</span>
          </div>

          <nav className="space-y-2">
            <div className="px-3 mb-4 text-[10px] uppercase tracking-[0.3em] text-gray-600 font-black">Categories</div>
            <button 
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!selectedCategory ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <TrendingUp size={18} />
              <span className="text-sm font-bold">Trending</span>
            </button>
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${selectedCategory === cat.id ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                <cat.icon size={18} />
                <span className="text-sm font-bold">{cat.name}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-gradient-to-br from-blue-900/10 to-purple-900/10 rounded-2xl border border-blue-500/10 p-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <div className="text-[10px] font-black text-blue-400 mb-1 uppercase tracking-[0.2em]">Promotion</div>
              <p className="text-xs text-white font-bold leading-tight mb-3">Get 10% off on all Stellar watches today.</p>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-[40%] transition-all duration-1000 group-hover:w-[60%]"></div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background Atmosphere */}
        <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] bg-blue-600/5 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-200px] left-[-200px] w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none"></div>

        <header className="h-24 border-b border-white/5 flex items-center px-8 lg:px-12 justify-between bg-brand-nav/40 backdrop-blur-3xl sticky top-0 z-20 shrink-0">
          <div className="flex-1 max-w-xl">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search premium electronics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 ml-12">
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative w-12 h-12 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all cursor-pointer group"
            >
              <ShoppingCart size={22} className="text-gray-300 group-hover:text-blue-400" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-4 border-brand-bg shadow-lg">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-4 pl-6 border-l border-white/5">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black uppercase text-white truncate max-w-[120px]">{user.displayName}</p>
                  <button onClick={() => signOut(auth)} className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-[0.1em]">Logout</button>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-400 to-rose-400 border border-white/20 p-0.5 shadow-xl">
                   <div className="w-full h-full bg-brand-bg rounded-[9px] flex items-center justify-center font-bold text-sm text-white">
                     {user.displayName?.[0] || 'U'}
                   </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
                className="bg-white text-brand-bg px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all shadow-xl active:scale-95 cursor-pointer"
              >
                Connect Account
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 lg:px-12 py-12 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-4xl font-black tracking-tighter uppercase text-white mb-2 italic">
                  {selectedCategory ? `${selectedCategory} Collection` : 'Elite Hardware'}
                </h2>
                <p className="text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em] font-black">Protocol_Shopping_Interface_v2.0.4</p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                <span>Displaying {filteredProducts.length} Items</span>
                <div className="h-px w-12 bg-white/10"></div>
                <span>Sort by: Relevance</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
              {filteredProducts.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#0d121f]/60 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden group hover:border-blue-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/5 relative"
                >
                  <div className="h-64 relative overflow-hidden">
                    <img 
                      src={p.imageUrl} 
                      alt={p.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-card/80 to-transparent"></div>
                    <div className="absolute top-4 left-4 flex gap-2">
                      {p.featured && (
                        <span className="bg-blue-500/80 backdrop-blur-md text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full tracking-[0.2em] shadow-lg">Featured</span>
                      )}
                      <span className="bg-white/10 backdrop-blur-md text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full tracking-[0.2em] border border-white/5">{CATEGORIES.find(c => c.id === p.categoryId)?.name}</span>
                    </div>
                  </div>
                  
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-black text-white tracking-tight leading-tight">{p.name}</h3>
                      <p className="text-2xl font-mono font-black text-blue-400">${p.price}</p>
                    </div>
                    <p className="text-gray-400 text-sm mb-8 line-clamp-2 font-medium leading-relaxed">{p.description}</p>
                    
                    <button 
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between gap-4 bg-white/5 border border-white/10 py-5 px-6 rounded-2xl group/btn hover:bg-blue-500 hover:border-blue-400 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Add_to_Cart</span>
                      <ChevronRight size={16} className="text-gray-600 group-hover/btn:text-white transition-all transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Cart Drawer overlay */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-brand-bg/60 backdrop-blur-sm z-40 lg:flex items-center justify-center p-8"
            >
              <motion.div 
                initial={{ x: 500 }}
                animate={{ x: 0 }}
                exit={{ x: 500 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-brand-sidebar border-l border-white/5 flex flex-col shadow-2xl z-50 p-10"
              >
                <div className="flex items-center justify-between mb-12">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter uppercase text-white italic">Shopping Cart</h2>
                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mt-1">Order_Summary_Data</p>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors cursor-pointer group">
                    <X className="text-gray-500 group-hover:text-white" size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                  {checkoutSuccess ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center py-20"
                    >
                      <div className="w-24 h-24 bg-emerald-500/20 rounded-[2.5rem] flex items-center justify-center mb-8 rotate-12 shadow-2xl shadow-emerald-500/20">
                        <Sparkles size={48} className="text-emerald-400" />
                      </div>
                      <h3 className="text-2xl font-black uppercase italic mb-2 text-white">Order Confirmed</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Transaction_Verified_OK</p>
                      <p className="mt-4 text-gray-500 text-xs font-medium">Your premium hardware is now being prepared for quantum delivery.</p>
                    </motion.div>
                  ) : cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale py-20 translate-y-[-10%]">
                      <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-8 rotate-12">
                        <ShoppingBag size={48} className="text-gray-500" />
                      </div>
                      <h3 className="text-xl font-black uppercase italic mb-2">Cart is empty</h3>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Awaiting_Hardware_Selection</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="flex gap-5 bg-white/5 p-5 rounded-3xl border border-white/5 group relative">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-black text-white truncate pr-6 uppercase tracking-tight">{item.name}</h4>
                          <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest font-bold">{CATEGORIES.find(c => c.id === item.categoryId)?.name}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-mono font-black text-blue-400">${item.price}</p>
                            <span className="text-[10px] font-black text-white px-3 py-1 bg-white/5 rounded-lg border border-white/5">QNT: {item.quantity}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-4 right-4 text-gray-600 hover:text-red-500 transition-colors p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-12 space-y-8">
                  <div className="pt-8 border-t border-white/5">
                    <div className="flex justify-between items-end mb-8">
                      <div>
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Total cost calculation</p>
                        <h4 className="text-4xl font-mono font-black text-white tracking-tighter">${totalPrice}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Selected items</p>
                        <p className="text-xl font-black text-white px-4 py-1 bg-white/5 rounded-xl border border-white/5 mt-1">{cart.reduce((a, b) => a + b.quantity, 0)}</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || checkoutLoading}
                      className="w-full h-18 bg-blue-500 hover:bg-blue-600 disabled:opacity-20 disabled:grayscale transition-all rounded-[1.25rem] font-black text-xs uppercase tracking-[0.3em] text-white shadow-2xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-4 cursor-pointer"
                    >
                      {checkoutLoading ? 'Processing_Batch...' : (
                        <>
                          Complete Purchase
                          <ChevronRight size={20} />
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-[8px] font-black text-gray-700 uppercase tracking-[0.3em]">
                    <span>Secure_Checkout</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span>Identity_Locked</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
