import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Flame, 
  Sparkles, 
  Sparkle, 
  TrendingUp, 
  ShoppingBag, 
  Play, 
  Pause,
  Award, 
  Volume2, 
  VolumeX, 
  Zap, 
  ScanLine, 
  User, 
  Share2, 
  Crown,
  Heart,
  Skull,
  ShieldAlert
} from 'lucide-react';

// Play sound synthetic effects using Web Audio API
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'buy') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.setValueAtTime(450, now + 0.08);
      osc.frequency.setValueAtTime(600, now + 0.16);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'level') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(261.63, now); // C4
      osc.frequency.setValueAtTime(329.63, now + 0.1); // E4
      osc.frequency.setValueAtTime(392.00, now + 0.2); // G4
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.4); // C5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.8);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
    }
  } catch (e) {
    console.error('AudioContext is blocked or not sustained in this environment yet', e);
  }
};

const UPGRADES_LIST = [
  {
    id: 'mewing',
    name: 'Mewing Streak',
    description: '🤫 Shh... Keep the tongue posture perfect for passive jawline gains.',
    cost: 15,
    aps: 0.5,
    icon: Flame,
    unlockedAt: 0,
  },
  {
    id: 'looksmax',
    name: 'Looksmaxxing E-Book',
    description: '📖 Read the sacred text of facial aesthetics.',
    cost: 100,
    aps: 4.0,
    icon: Sparkle,
    unlockedAt: 50,
  },
  {
    id: 'canthal',
    name: 'Canthal Tilt Adjuster',
    description: '👁️ Instant hunter eyes configuration for superior looks.',
    cost: 750,
    aps: 25.0,
    icon: Sparkles,
    unlockedAt: 300,
  },
  {
    id: 'rizz_course',
    name: 'Rizz Academy Course',
    description: '🎤 Learn the secrets of unspoken rizz and charisma.',
    cost: 4500,
    aps: 120.0,
    icon: Zap,
    unlockedAt: 2000,
  },
  {
    id: 'ice_bath',
    name: 'Cold Ice Bath Session',
    description: '❄️ Extreme cold exposure to increase your masculine energy.',
    cost: 20000,
    aps: 650.0,
    icon: Award,
    unlockedAt: 10000,
  },
  {
    id: 'gigachad',
    name: 'GigaChad DNA Infusion',
    description: '🧬 Full cellular restructuring relative to the Chad model.',
    cost: 125000,
    aps: 4200.0,
    icon: Crown,
    unlockedAt: 50000,
  }
];

function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('aura_username') || '');
  const [inputName, setInputName] = useState('');
  const webcamRef = useRef(null);
  const [webcamStream, setWebcamStream] = useState(null);
  const [webcamError, setWebcamError] = useState('');
  
  const [aura, setAura] = useState(() => {
    const saved = localStorage.getItem('aura_pts');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [upgrades, setUpgrades] = useState(() => {
    const saved = localStorage.getItem('aura_upgrades');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Merge saved counts with base UPGRADES_LIST to retain Icon component functions!
          return UPGRADES_LIST.map(baseUpg => {
            const savedUpg = parsed.find(p => p.id === baseUpg.id);
            return { ...baseUpg, count: savedUpg ? savedUpg.count : 0 };
          });
        }
      } catch (e) {}
    }
    return UPGRADES_LIST.map(upg => ({ ...upg, count: 0 }));
  });

  // Persist aura and upgrades across page refreshes
  useEffect(() => {
    localStorage.setItem('aura_pts', aura.toString());
  }, [aura]);

  useEffect(() => {
    // Save only minimalistic counts to avoid storing large properties globally
    const toSave = upgrades.map(u => ({ id: u.id, count: u.count }));
    localStorage.setItem('aura_upgrades', JSON.stringify(toSave));
  }, [upgrades]);
  
  const [activeTab, setActiveTab] = useState('shop'); // 'shop' | 'leaderboard'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [floatParticles, setFloatParticles] = useState([]);
  const [scanActive, setScanActive] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Determine user Aura tier based on points
  const getAuraTier = (pts) => {
    if (pts < 0) return { title: 'Skibidi Recruit 💀', class: 'text-rose-400', color: '#f87171' };
    if (pts < 50) return { title: 'Beta Crawler 🐛', class: 'text-gray-400', color: '#9ca3af' };
    if (pts < 500) return { title: 'Sharp Looksmaxxer ✨', class: 'text-cyan-400', color: '#22d3ee' };
    if (pts < 3000) return { title: 'Mewing Apprentice 🤫', class: 'text-purple-400', color: '#c084fc' };
    if (pts < 15000) return { title: 'Charisma Overlord 🎤', class: 'text-indigo-400', color: '#818cf8' };
    if (pts < 100000) return { title: 'Pure GigaChad 🧬', class: 'text-emerald-400', color: '#34d399' };
    return { title: 'Aura Deity 👑', class: 'text-yellow-400', color: '#fbbf24' };
  };

  const currentTier = getAuraTier(aura);

  const [globalLeaderboard, setGlobalLeaderboard] = useState([
    { username: '👑 Chico Coins', aura: 999999, tier: 'Chad Supremo 👑' },
    { username: '🥈 GigaChad Original', aura: 750000, tier: 'Mewing God 🤫' },
    { username: '🥉 Baby Gronk', aura: 450000, tier: 'Sigma Rizzler ⚡' }
  ]);

  // Connect to realtime Firebase Firestore database
  useEffect(() => {
    if (!username) return;
    const q = query(collection(db, 'leaderboard'), orderBy('aura', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leaderboardData = [];
      snapshot.forEach((doc) => {
        leaderboardData.push(doc.data());
      });
      if (leaderboardData.length > 0) {
        setGlobalLeaderboard(leaderboardData);
      }
    }, (err) => {
      console.error("Firestore read error:", err);
    });
    return () => unsubscribe();
  }, [username]);

  // Throttle updates to the leaderboard database
  useEffect(() => {
    if (!username || aura <= 0) return;
    const timer = setTimeout(async () => {
      const normalizedName = username.startsWith('@') ? username : `@${username}`;
      try {
        await setDoc(doc(db, 'leaderboard', normalizedName), {
          username: normalizedName,
          aura: Math.round(aura),
          tier: currentTier.title
        });
      } catch (err) {
        console.error("Firestore write error:", err);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [aura, username, currentTier]);

  // Compute Aura Per Second (APS)
  const aps = upgrades.reduce((acc, curr) => acc + (curr.count * curr.aps), 0);
  // Auto-playing video loop gives permanent x2 bonus!
  const videoMultiplier = 2;
  const totalAps = aps * videoMultiplier;

  // Passive farming timer setup (smoothly adding aura every 100ms)
  useEffect(() => {
    const interval = setInterval(() => {
      if (totalAps > 0 && username) {
        setAura(prev => prev + (totalAps * 0.1));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [totalAps, username]);

  // Clean float particles when animation ends
  useEffect(() => {
    if (floatParticles.length > 0) {
      const timer = setTimeout(() => {
        setFloatParticles(prev => prev.slice(1));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [floatParticles]);



  // Set Username Function
  const handleSaveUsername = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    localStorage.setItem('aura_username', inputName.trim());
    setUsername(inputName.trim());
    if (soundEnabled) playSound('level');
  };

  // Active Farming Trigger
  const handleFarmAura = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Increment points (higher based on purchases + a base of 1)
    const baseClick = 1;
    const clickBonus = upgrades.reduce((acc, curr) => acc + (curr.count * 0.5), 0);
    const earned = Math.round((baseClick + clickBonus) * videoMultiplier);

    setAura(prev => prev + earned);
    
    if (soundEnabled) playSound('click');

    // Add float particle
    setFloatParticles(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x,
        y,
        text: `+${earned}`
      }
    ]);
  };

  // Buy Upgrades
  const buyUpgrade = (upgradeId) => {
    const upgrade = upgrades.find(u => u.id === upgradeId);
    if (!upgrade || aura < upgrade.cost) return;

    setAura(prev => prev - upgrade.cost);
    setUpgrades(prev => prev.map(u => {
      if (u.id === upgradeId) {
        return {
          ...u,
          count: u.count + 1,
          cost: Math.round(u.cost * 1.28) // scale cost
        };
      }
      return u;
    }));

    if (soundEnabled) playSound('buy');
  };

  // Sound control
  const toggleSound = () => {
    setSoundEnabled(prev => !prev);
  };

  // Cleanup webcam stream on unmount
  useEffect(() => {
    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [webcamStream]);

  // Sigma face scan simulation
  const startSigmaScan = () => {
    if (scanActive) return;
    setScanActive(true);
    setScanProgress(0);
    setScanResult('');
    setWebcamError('');
    if (soundEnabled) playSound('scan');

    // Attempt to access webcam
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Webcam not available in this context (requires safe mock context).');
      setWebcamError('Sem permissão de câmera (requer HTTPS ou localhost). Rodando scanner sintético...');
      
      // Fallback to fake scanning
      let count = 0;
      const interval = setInterval(() => {
        count += 5;
        setScanProgress(count);
        if (count >= 100) {
          clearInterval(interval);
          const scanOutcomes = [
            { msg: 'Sigma Tier: Perfect Hunter Canthal Tilt (+250 Aura) 👑', bonus: 250 },
            { msg: 'Gigachad Jawline Verified (+1000 Aura) 🧬', bonus: 1000 },
            { msg: 'Looksmaxxer Level 99: Bone Smashed Properly (+500 Aura) ✨', bonus: 500 },
            { msg: 'W Rizz: Level 10 Gym Gymnast (+150 Aura) 🤫', bonus: 150 },
            { msg: 'Skibidi Toilet detected: -100 Aura 💀', bonus: -100 }
          ];
          const selected = scanOutcomes[Math.floor(Math.random() * scanOutcomes.length)];
          setScanResult(selected.msg);
          setAura(prev => Math.max(0, prev + selected.bonus));
          if (soundEnabled) playSound(selected.bonus > 0 ? 'level' : 'click');
          setScanActive(false);
        }
      }, 150);
      return;
    }

    navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: 'user' } })
      .then((stream) => {
        setWebcamStream(stream);
        setTimeout(() => {
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream;
          }
        }, 50);

        // Run scanner animation
        let count = 0;
        const interval = setInterval(() => {
          count += 5;
          setScanProgress(count);
          if (count >= 100) {
            clearInterval(interval);
            
            // Random results
            const scanOutcomes = [
              { msg: 'Sigma Tier: Perfect Hunter Canthal Tilt (+250 Aura) 👑', bonus: 250 },
              { msg: 'Gigachad Jawline Verified (+1000 Aura) 🧬', bonus: 1000 },
              { msg: 'Looksmaxxer Level 99: Bone Smashed Properly (+500 Aura) ✨', bonus: 500 },
              { msg: 'W Rizz: Level 10 Gym Gymnast (+150 Aura) 🤫', bonus: 150 },
              { msg: 'Skibidi Toilet detected: -100 Aura 💀', bonus: -100 }
            ];

            const selected = scanOutcomes[Math.floor(Math.random() * scanOutcomes.length)];
            setScanResult(selected.msg);
            setAura(prev => Math.max(0, prev + selected.bonus));
            if (soundEnabled) playSound(selected.bonus > 0 ? 'level' : 'click');
            
            // Stop and release video stream
            stream.getTracks().forEach(track => track.stop());
            setWebcamStream(null);
            setScanActive(false);
          }
        }, 150); // Total ~3s scan
      })
      .catch((err) => {
        console.warn('Webcam permission denied or unavailable:', err);
        setWebcamError('Sem webcam. Rodando scanner sintético...');
        
        // Fallback to fake scanning
        let count = 0;
        const interval = setInterval(() => {
          count += 5;
          setScanProgress(count);
          if (count >= 100) {
            clearInterval(interval);
            const scanOutcomes = [
              { msg: 'Sigma Tier: Perfect Hunter Canthal Tilt (+250 Aura) 👑', bonus: 250 },
              { msg: 'Gigachad Jawline Verified (+1000 Aura) 🧬', bonus: 1000 },
              { msg: 'Looksmaxxer Level 99: Bone Smashed Properly (+500 Aura) ✨', bonus: 500 },
              { msg: 'W Rizz: Level 10 Gym Gymnast (+150 Aura) 🤫', bonus: 150 },
              { msg: 'Skibidi Toilet detected: -100 Aura 💀', bonus: -100 }
            ];
            const selected = scanOutcomes[Math.floor(Math.random() * scanOutcomes.length)];
            setScanResult(selected.msg);
            setAura(prev => Math.max(0, prev + selected.bonus));
            if (soundEnabled) playSound(selected.bonus > 0 ? 'level' : 'click');
            setScanActive(false);
          }
        }, 150);
      });
  };

  // If username is not set, show the initial onboarding modal
  if (!username) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        position: 'relative'
      }}>
        <div className="glass-panel" style={{
          padding: '2.5rem 2rem',
          maxWidth: '460px',
          width: '100%',
          textAlign: 'center',
          border: '2px solid rgba(192, 132, 252, 0.35)',
          boxShadow: '0 0 40px rgba(192, 132, 252, 0.15)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #c084fc 0%, #22d3ee 100%)',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 0 20px rgba(192, 132, 252, 0.5)'
          }}>
            <Flame size={32} color="#fff" />
          </div>

          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.8rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            background: 'linear-gradient(to right, #ffffff, #c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            AURA FINER 9000
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            Digite seu username de Sigma para iniciar sua jornada de Looksmaxxing e acumular Aura.
          </p>

          <form onSubmit={handleSaveUsername} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="@seu_user..." 
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              maxLength={15}
              required
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--border-neon)',
                borderRadius: '10px',
                color: 'white',
                padding: '0.85rem 1rem',
                fontSize: '1rem',
                textAlign: 'center',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-neon)'}
            />

            <button 
              type="submit" 
              className="btn-glow" 
              style={{ 
                padding: '0.85rem', 
                borderRadius: '10px', 
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Zap size={18} fill="white" />
              Ascender para Sigma
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* Header Panel */}
      <header className="glass-panel" style={{ 
        padding: '1.5rem', 
        marginBottom: '2rem', 
        display: 'flex', 
        flexWrap: 'wrap',
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #c084fc 0%, #22d3ee 100%)',
            padding: '0.5rem',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(192, 132, 252, 0.4)'
          }}>
            <Flame size={28} color="#fff" />
          </div>
          <div>
            <h1 style={{ 
              fontFamily: 'var(--font-heading)', 
              fontSize: '1.8rem', 
              fontWeight: 800,
              background: 'linear-gradient(to right, #f3f4f6, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              AURA FINER 9000
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Looksmaxxing & Rizz Farming Simulator
            </p>
          </div>
        </div>

        {/* Global Stats */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status Rizz ({username})</div>
            <div style={{ fontWeight: 700, color: currentTier.color, fontSize: '1rem' }}>
              {currentTier.title}
            </div>
          </div>

          <button onClick={toggleSound} style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: 'white',
            padding: '0.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="layout">
        
        {/* Left Column: Player, Video, active farming components */}
        <section className="left-column-layout">
          
          {/* Main Aura Video Player (Autoplayed Loop Muted, Bypassed Dialogs) */}
          <div className="glass-panel" style={{ 
            padding: '1.25rem', 
            position: 'relative', 
            overflow: 'hidden',
          }}>
            <h2 style={{ 
              fontFamily: 'var(--font-heading)', 
              fontSize: '1.3rem', 
              marginBottom: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <Play size={20} color="var(--primary)" />
              Aura Booster Hub
            </h2>

            {/* Video Canvas Container */}
            <div style={{ 
              width: '100%', 
              maxWidth: '340px',
              margin: '0 auto',
              borderRadius: '12px', 
              overflow: 'hidden', 
              position: 'relative',
              backgroundColor: '#000',
              border: '2px solid rgba(192, 132, 252, 0.15)',
              boxShadow: '0 0 25px rgba(0, 0, 0, 0.4)',
              aspectRatio: '9/16'
            }}>
              {/* Autoplay loop muted video */}
              <video 
                src="/aura.mp4" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loop 
                muted
                autoPlay
                playsInline
              />
              
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(168, 85, 247, 0.85)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                animation: 'rizzPulse 1.5s infinite',
                color: 'white',
                pointerEvents: 'none'
              }}>
                <Flame size={12} fill="white" />
                BOOSTER 2X MULTIPLIER ACTIVE
              </div>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center' }}>
              ⚡ O vídeo roda em looping de fundo garantindo um booster 2X de Rizz constante!
            </p>
          </div>

          {/* Sibling column container to group Clicker & Scanner vertically */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Active CLICK/TAP Farm Area */}
            <div className="glass-panel" style={{ 
              padding: '2rem', 
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              position: 'relative'
            }}>
              <div className="float-container">
                {floatParticles.map(p => (
                  <span 
                    key={p.id} 
                    className="floating-aura"
                    style={{ left: `${p.x}px`, top: `${p.y}px` }}
                  >
                    {p.text}
                  </span>
                ))}
              </div>

              <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px' }}>
                  Total Aura Farmada
                </div>
                <div style={{ 
                  fontFamily: 'var(--font-heading)', 
                  fontSize: '3.5rem', 
                  fontWeight: 900,
                  color: 'white',
                  textShadow: '0 0 20px rgba(192, 132, 252, 0.6)'
                }}>
                  {Math.round(aura).toLocaleString()}
                </div>
                <div style={{ 
                  fontSize: '0.9rem', 
                  color: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}>
                  <TrendingUp size={16} />
                  +{totalAps.toFixed(1)} Aura/seg (Multiplicador de Vídeo 2X Aplicado)
                </div>
              </div>

              {/* Glowing active clicks sphere */}
              <div 
                onClick={handleFarmAura}
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(192, 132, 252, 0.8) 0%, rgba(139, 92, 246, 0.4) 70%, rgba(5, 4, 9, 0.7) 100%)',
                  border: '3px solid rgba(192, 132, 252, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  boxShadow: '0 0 35px rgba(34, 211, 238, 0.5)',
                  transition: 'all 0.1s ease',
                  position: 'relative'
                }}
                className="btn-glow"
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>TAP / CLICK</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>+{(1 + upgrades.reduce((acc, curr) => acc + (curr.count * 0.5), 0)) * videoMultiplier} Aura</span>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                Clique na esfera de energia para acumular Aura manualmente! ⚡
              </p>
            </div>

            {/* Sigma Scan Simulator (mini game with direct webcam access) */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ 
                fontFamily: 'var(--font-heading)', 
                fontSize: '1.2rem', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <ScanLine size={18} color="var(--secondary)" />
                Simulador de Scanner Facial Sigma
              </h3>
              
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Deixe a IA analisar seu nível de Chad para ganhar (ou perder) Aura Instantaneamente!
              </p>

              <div style={{
                background: '#090810',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                width: '100%',
                height: '240px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '1rem'
              }}>
                {/* Live Webcam Stream */}
                {scanActive && webcamStream && (
                  <video 
                    ref={webcamRef}
                    autoPlay 
                    playsInline 
                    muted 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.6,
                      zIndex: 1
                    }}
                  />
                )}

                {/* Cyber Scanner Grid Overlay */}
                {scanActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    border: '2px solid rgba(34, 211, 238, 0.4)',
                    background: 'radial-gradient(circle, transparent 30%, rgba(9, 8, 16, 0.6) 100%)',
                    zIndex: 2,
                    pointerEvents: 'none'
                  }}>
                    {/* Horizontal Scanning laser line */}
                    <div style={{
                      position: 'absolute',
                      top: `${scanProgress}%`,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(to right, transparent, var(--secondary), transparent)',
                      boxShadow: '0 0 12px var(--secondary)',
                      transition: 'top 0.1s linear'
                    }} />
                    
                    {/* Science Corners */}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', width: '15px', height: '15px', borderLeft: '2px solid var(--secondary)', borderTop: '2px solid var(--secondary)' }} />
                    <div style={{ position: 'absolute', top: '10px', right: '10px', width: '15px', height: '15px', borderRight: '2px solid var(--secondary)', borderTop: '2px solid var(--secondary)' }} />
                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '15px', height: '15px', borderLeft: '2px solid var(--secondary)', borderBottom: '2px solid var(--secondary)' }} />
                    <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '15px', height: '15px', borderRight: '2px solid var(--secondary)', borderBottom: '2px solid var(--secondary)' }} />
                  </div>
                )}

                {/* Scanner Idle State */}
                {!scanActive && !scanResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', zIndex: 3 }}>
                    <div style={{ 
                      width: '70px', 
                      height: '70px', 
                      borderRadius: '50%', 
                      border: '2px dashed rgba(255,255,255,0.15)',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--text-secondary)'
                    }}>
                      <User size={30} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Câmera Desativada
                    </span>
                  </div>
                )}

                {/* Scanner Running Synthetic Warning */}
                {scanActive && webcamError && (
                  <div style={{
                    zIndex: 3,
                    position: 'absolute',
                    bottom: '10px',
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {webcamError}
                  </div>
                )}

                {/* Progress bar inside webcam card container when scanning */}
                {scanActive && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    left: '15px', 
                    right: '15px', 
                    zIndex: 3, 
                    background: 'rgba(0,0,0,0.6)', 
                    padding: '8px', 
                    borderRadius: '8px' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'white' }}>
                      <span>Analisando proporções faciais...</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${scanProgress}%`, height: '100%', background: 'var(--secondary)', borderRadius: '3px', transition: 'width 0.1s linear' }} />
                    </div>
                  </div>
                )}

                {/* Scanner Output Result Screen */}
                {!scanActive && scanResult && (
                  <div style={{ textAlign: 'center', padding: '1.25rem', zIndex: 3, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContainer: 'center', justifyContent: 'center', background: 'rgba(9, 8, 16, 0.85)' }}>
                    <div style={{ 
                      fontWeight: 800, 
                      color: scanResult.includes('-') ? 'var(--danger)' : 'var(--success)', 
                      fontSize: '1rem',
                      marginBottom: '1rem',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      maxWidth: '90%'
                    }}>
                      {scanResult}
                    </div>
                    <button 
                      onClick={startSigmaScan}
                      className="btn-glow" 
                      style={{ padding: '0.5rem 1.5rem', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      Escanear Novamente
                    </button>
                  </div>
                )}
              </div>

              {/* Start Scan Button when idle */}
              {!scanActive && !scanResult && (
                <button 
                  onClick={startSigmaScan}
                  className="btn-glow" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  INICIAR SCANNER CHAD
                </button>
              )}
            </div>

          </div>
        </section>

        {/* Right Column: Upgrades Shop & Stats */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Shop Control Tabs */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => setActiveTab('shop')} 
              style={{
                flex: 1,
                padding: '0.65rem',
                border: 'none',
                background: activeTab === 'shop' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                color: activeTab === 'shop' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: activeTab === 'shop' ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid transparent'
              }}
            >
              <ShoppingBag size={16} />
              Looks Shop
            </button>
            <button 
              onClick={() => setActiveTab('leaderboard')} 
              style={{
                flex: 1,
                padding: '0.65rem',
                border: 'none',
                background: activeTab === 'leaderboard' ? 'rgba(192, 132, 252, 0.15)' : 'transparent',
                color: activeTab === 'leaderboard' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 700,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: activeTab === 'leaderboard' ? '1px solid rgba(192, 132, 252, 0.3)' : '1px solid transparent'
              }}
            >
              <Crown size={16} />
              Ranking
            </button>
          </div>

          {/* Dynamic Content Panel */}
          {activeTab === 'shop' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ 
                fontFamily: 'var(--font-heading)', 
                fontSize: '1.2rem', 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <ShoppingBag size={18} color="var(--primary)" />
                Upgrades de Aura
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {upgrades.map(upg => {
                  const cantAfford = aura < upg.cost;
                  const isLocked = aura < upg.unlockedAt && upg.count === 0;
                  const IconComp = upg.icon;

                  if (isLocked) {
                    return (
                      <div key={upg.id} className="upgrade-card locked" style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ padding: '0.5rem', background: '#222', borderRadius: '8px' }}>
                            <Skull size={18} color="#666" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#666', fontSize: '0.9rem' }}>Item Bloqueado</div>
                            <div style={{ fontSize: '0.75rem', color: '#555' }}>Libera com {upg.unlockedAt} Aura</div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={upg.id} 
                      className={`upgrade-card unlocked`}
                      onClick={() => buyUpgrade(upg.id)}
                      style={{ 
                        opacity: cantAfford ? 0.65 : 1,
                        cursor: cantAfford ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirections: 'column', gap: '0.5rem', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            padding: '0.5rem', 
                            background: cantAfford ? 'rgba(255,255,255,0.03)' : 'rgba(192, 132, 252, 0.1)', 
                            borderRadius: '8px', 
                            color: cantAfford ? '#888' : 'var(--primary)' 
                          }}>
                            <IconComp size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {upg.name} 
                              {upg.count > 0 && (
                                <span style={{ 
                                  background: 'var(--primary)', 
                                  color: 'black', 
                                  fontSize: '0.65rem', 
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 800
                                }}>
                                  x{upg.count}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              +{upg.aps} Aura/s
                            </div>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '0.25rem' }}>
                          {upg.description}
                        </p>
                      </div>

                      <div style={{ textAlign: 'right', marginLeft: '0.75rem' }}>
                        <div style={{ 
                          fontWeight: 800, 
                          color: cantAfford ? 'var(--text-secondary)' : '#fbbf24',
                          fontSize: '0.9rem'
                        }}>
                          {upg.cost.toLocaleString()} Aura
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Personalized Leaderboard */}
          {activeTab === 'leaderboard' && (
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ 
                fontFamily: 'var(--font-heading)', 
                fontSize: '1.2rem', 
                marginBottom: '1rem',
                display: 'flex', 
                alignItems: 'center',
                gap: '6px' 
              }}>
                <Crown size={18} color="#fbbf24" />
                Mundial de Rizzlers
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {globalLeaderboard.length > 0 ? (
                  globalLeaderboard.slice(0, 10).map((player, index) => {
                    const isCurrentUser = player.username === (username.startsWith('@') ? username : `@${username}`);
                    const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    const color = index === 0 ? '#fbbf24' : isCurrentUser ? 'var(--primary)' : 'var(--text-primary)';
                    const bg = isCurrentUser 
                      ? 'rgba(192, 132, 252, 0.15)' 
                      : index === 0 
                        ? 'rgba(251, 191, 36, 0.08)' 
                        : 'rgba(226, 232, 240, 0.04)';
                    const border = isCurrentUser 
                      ? '1px solid rgba(192, 132, 252, 0.4)' 
                      : index === 0 
                        ? '1px solid rgba(251, 191, 36, 0.2)' 
                        : '1px solid rgba(255, 255, 255, 0.05)';

                    return (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: bg,
                        border: border,
                        borderRadius: '10px',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: isCurrentUser ? 850 : 700, display: 'flex', alignItems: 'center', gap: '6px', color }}>
                          {badge} {player.username} ({player.tier})
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color }}>
                          {Math.round(player.aura).toLocaleString()} Aura
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '10px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🥇 1. Chico Coins (Sigma)
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fbbf24' }}>999,999 Aura</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(226, 232, 240, 0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        🥈 2. GigaChad Original
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>750,000 Aura</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(226, 232, 240, 0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        🥉 3. Baby Gronk (Rizzler)
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>450,000 Aura</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(192, 132, 252, 0.15)',
                      border: '1px solid rgba(192, 132, 252, 0.4)',
                      borderRadius: '10px',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 850, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                        🔥 4. {username} ({currentTier.title})
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {Math.round(aura).toLocaleString()} Aura
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

      </main>

      <footer style={{ 
        textAlign: 'center', 
        marginTop: '3rem', 
        padding: '1.5rem', 
        color: 'var(--text-secondary)',
        fontSize: '0.8rem',
        borderTop: '1px solid rgba(255,255,255,0.06)'
      }}>
        © 2026 AURA FINER 9000. Desenvolvido para máxima estética e entretenimento de Sigma.
      </footer>
    </div>
  );
}

export default App;
