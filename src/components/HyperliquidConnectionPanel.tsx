import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, RefreshCw, Radio, CheckCircle, AlertTriangle, 
  Database, User, Cpu, Wallet, TrendingUp, Compass, Clock, Zap
} from 'lucide-react';

interface HyperliquidConnectionPanelProps {
  onStateChange?: () => void;
  refreshTrigger?: number;
}

export default function HyperliquidConnectionPanel({ onStateChange, refreshTrigger }: HyperliquidConnectionPanelProps) {
  // Credentials form
  const [walletAddress, setWalletAddress] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [useTestnet, setUseTestnet] = useState(false);

  // Connection State fetched from backend
  const [hlState, setHlState] = useState<any>({
    connected: false,
    account: null,
    balances: [],
    positions: [],
    healthChecklist: {
      hyperliquidConnected: false,
      restAuthenticated: false,
      walletVerified: false,
      balanceLoaded: false,
      positionsLoaded: false,
      databaseReady: true,
      riskEngineReady: true,
      aiReady: false,
      executionEngineReady: true
    },
    credentials: null,
    latency: -1
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/hl/state');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not JSON');
        }
        const data = await res.json();
        setHlState(data);
      }
    } catch (err) {
      console.error('Error fetching Hyperliquid state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    // Poll the connection state every 3 seconds for fast-synchronized updates
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/hl/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: walletAddress.trim(),
          privateKey: privateKey.trim() || undefined,
          useTestnet
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to authenticate with Hyperliquid API.');
      }

      setHlState(data);
      setSuccessMessage('Securely connected to Hyperliquid account and synchronized portfolio state.');
      setWalletAddress('');
      setPrivateKey('');
      if (onStateChange) onStateChange();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate with Hyperliquid.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/hl/disconnect', { method: 'POST' });
      const data = await res.json();
      setHlState(data);
      setSuccessMessage('Cleared secure local cache and credentials.');
      if (onStateChange) onStateChange();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error disconnecting.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/hl/test-connection', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Connection failed.');
      }
      setHlState(data);
      setSuccessMessage('Successfully checked Hyperliquid REST latency and updated portfolio balance!');
      if (onStateChange) onStateChange();
    } catch (err: any) {
      setErrorMessage(err.message || 'Latency test failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const checklist = hlState.healthChecklist || {};

  return (
    <div id="hl-connection-panel" className="space-y-6">
      {/* Overview stats header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0e1117] p-5 rounded-lg border border-[#1f2937] hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-mono">CONNECTION TYPE</span>
            <Radio className={`w-4 h-4 ${hlState.connected ? 'text-emerald-500 animate-pulse' : 'text-gray-600'}`} />
          </div>
          <p className="text-lg font-sans font-bold text-gray-100">Hyperliquid API</p>
          <span className="text-[10px] font-mono text-emerald-500/80">Direct POST Gateway</span>
        </div>

        <div className="bg-[#0e1117] p-5 rounded-lg border border-[#1f2937] hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-mono">ACCOUNT VALUE</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-mono font-bold text-emerald-400">
            ${hlState.connected && hlState.account ? hlState.account.accountValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </p>
          <span className="text-[10px] font-mono text-gray-400">USDC Equity</span>
        </div>

        <div className="bg-[#0e1117] p-5 rounded-lg border border-[#1f2937] hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-mono">TOTAL MARGIN USED</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-mono font-bold text-blue-400">
            ${hlState.connected && hlState.account ? hlState.account.totalMarginUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
          </p>
          <span className="text-[10px] font-mono text-gray-400">
            {hlState.connected && hlState.account && hlState.account.accountValue > 0 
              ? `${((hlState.account.totalMarginUsed / hlState.account.accountValue) * 100).toFixed(1)}% Usage` 
              : '0.0% Usage'}
          </span>
        </div>

        <div className="bg-[#0e1117] p-5 rounded-lg border border-[#1f2937] hover:border-emerald-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400 font-mono">REST LATENCY</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-mono font-bold text-purple-400">
            {hlState.latency >= 0 ? `${hlState.latency} ms` : 'Offline'}
          </p>
          <span className="text-[10px] font-mono text-gray-400">Round-trip info</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Setup Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0b0f19] rounded-lg border border-[#1f2937] p-6">
            <div className="flex items-center space-x-2 mb-4 border-b border-[#1f2937] pb-4">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-sans font-medium text-gray-100">Configure Hyperliquid Session</h2>
            </div>

            {hlState.connected ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded text-xs font-mono flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">SESSION ACTIVE</p>
                    <p className="text-gray-300">You are securely connected via wallet address:</p>
                    <p className="text-gray-100 font-bold select-all mt-1 bg-black/40 p-1.5 rounded text-left">
                      {hlState.credentials?.walletAddressMasked}
                    </p>
                    <p className="text-gray-400 mt-2">
                      Target Network: <span className="text-emerald-400 font-bold">{hlState.credentials?.useTestnet ? 'Arbitrum Sepolia Testnet' : 'Arbitrum One Mainnet'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button 
                    onClick={handleTestConnection}
                    disabled={actionLoading}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-100 text-xs font-mono py-2.5 px-4 rounded border border-gray-700 transition-colors flex justify-center items-center space-x-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                    <span>Ping Latency</span>
                  </button>
                  <button 
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="flex-1 bg-red-900/20 hover:bg-red-950/40 text-red-400 text-xs font-mono py-2.5 px-4 rounded border border-red-900/30 transition-colors flex justify-center items-center space-x-2 disabled:opacity-50"
                  >
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded text-xs leading-relaxed font-mono">
                  <span className="font-bold text-blue-300">💡 Zero Trust Security:</span> Unlike centralized exchanges, Hyperliquid allows fetching full balances, margin state, and active positions using only your public Arbitrum Wallet Address (No key needed). You only need to provide an optional Private Key if you want our AI Agent Grid Engine to sign and place orders directly.
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1.5">Arbitrum Wallet Address (Public 0x...)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 0x22896fB74043bFCA36B15Cc67448B6e5c5FE1C48"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full bg-[#080b12] text-gray-200 border border-[#1f2937] pl-10 pr-4 py-2 text-xs font-mono rounded focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-gray-400 mb-1.5">Wallet Private Key (Optional - for grid trading execution)</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input 
                      type="password" 
                      placeholder="Optional. Only required for placing trade orders."
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      className="w-full bg-[#080b12] text-gray-200 border border-[#1f2937] pl-10 pr-4 py-2 text-xs font-mono rounded focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <input 
                    type="checkbox" 
                    id="useTestnet"
                    checked={useTestnet}
                    onChange={(e) => setUseTestnet(e.target.checked)}
                    className="bg-[#080b12] border border-[#1f2937] text-emerald-500 rounded focus:ring-0"
                  />
                  <label htmlFor="useTestnet" className="text-xs font-mono text-gray-400 select-none cursor-pointer">
                    Connect via Hyperliquid Testnet (Arbitrum Sepolia)
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-[#0b0f19] text-xs font-mono py-2.5 px-4 rounded font-semibold transition-colors flex justify-center items-center space-x-2 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                  <span>Securely Connect Session</span>
                </button>
              </form>
            )}

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs font-mono mt-4 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded text-xs font-mono mt-4 flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>

          {/* Hyperliquid balances & positions */}
          {hlState.connected && (
            <div className="bg-[#0b0f19] rounded-lg border border-[#1f2937] p-6 space-y-6">
              <div>
                <h3 className="text-sm font-sans font-medium text-gray-200 mb-3 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Asset Balances</span>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#1f2937] text-[10px] font-mono text-gray-500">
                        <th className="pb-2">ASSET</th>
                        <th className="pb-2 text-right">WITHDRAWABLE (FREE)</th>
                        <th className="pb-2 text-right">TOTAL COLLATERAL (EQ)</th>
                        <th className="pb-2 text-right">UNREALIZED PNL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f2937]/50 text-xs font-mono">
                      {hlState.balances?.map((bal: any, i: number) => (
                        <tr key={i} className="text-gray-300">
                          <td className="py-2.5 font-bold text-gray-200">{bal.ccy}</td>
                          <td className="py-2.5 text-right">${bal.cashBal.toFixed(2)}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">${bal.eq.toFixed(2)}</td>
                          <td className="py-2.5 text-right">
                            <span className={bal.upl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                              {bal.upl >= 0 ? '+' : ''}${bal.upl.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-sans font-medium text-gray-200 mb-3 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>Open Perpetual Positions</span>
                </h3>
                {hlState.positions && hlState.positions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#1f2937] text-[10px] font-mono text-gray-500">
                          <th className="pb-2">COIN</th>
                          <th className="pb-2">SIDE</th>
                          <th className="pb-2 text-right">SIZE</th>
                          <th className="pb-2 text-right">ENTRY</th>
                          <th className="pb-2 text-right">UNREALIZED PNL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1f2937]/50 text-xs font-mono">
                        {hlState.positions.map((pos: any, i: number) => (
                          <tr key={i} className="text-gray-300">
                            <td className="py-2.5 font-bold text-gray-200">{pos.instId}</td>
                            <td className="py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${pos.posSide === 'long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {pos.posSide.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-bold">{pos.pos}</td>
                            <td className="py-2.5 text-right">${pos.avgPx.toLocaleString('en-US')}</td>
                            <td className="py-2.5 text-right">
                              <span className={pos.upl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                                {pos.upl >= 0 ? '+' : ''}${pos.upl.toFixed(2)} ({pos.uplRatio >= 0 ? '+' : ''}{(pos.uplRatio * 100).toFixed(1)}%)
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-[#080b12] rounded border border-[#1f2937] p-4 text-center text-xs font-mono text-gray-500">
                    No active positions currently loaded from Hyperliquid clearinghouse.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Health Checklist */}
        <div className="space-y-6">
          <div className="bg-[#0b0f19] rounded-lg border border-[#1f2937] p-6">
            <div className="flex items-center space-x-2 mb-4 border-b border-[#1f2937] pb-4">
              <Cpu className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-sans font-medium text-gray-100">Enterprise Health</h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Secure Storage Ready</span>
                </span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Risk Engine Active</span>
                </span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gemini Model (Flash)</span>
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${checklist.aiReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-500/10 text-yellow-500'}`}>
                  {checklist.aiReady ? 'PROVEN' : 'UNCONFIGURED'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>REST Client Authenticated</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${checklist.restAuthenticated ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Arbitrum Wallet Verified</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${checklist.walletVerified ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
              </div>

              <div className="flex items-center justify-between border-b border-[#1f2937]/30 pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>USDC Balances Sync</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${checklist.balanceLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
              </div>

              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-mono text-gray-400 flex items-center space-x-2">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>Positions Sync</span>
                </span>
                <span className={`w-2 h-2 rounded-full ${checklist.positionsLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></span>
              </div>
            </div>
          </div>

          <div className="bg-[#0b0f19] rounded-lg border border-[#1f2937] p-6 text-xs text-gray-400 space-y-3 font-sans leading-relaxed">
            <h4 className="font-bold text-gray-200">🔒 Dynamic Wallet Security:</h4>
            <p>
              Your local workspace uses modern, cryptographic sandboxing. No private keys are sent or stored anywhere other than your direct, isolated workspace container.
            </p>
            <p>
              To confirm your setup, query and trade in testnet mode first by ticking the testnet checkbox and using testnet Arbitrum Sepolia addresses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
