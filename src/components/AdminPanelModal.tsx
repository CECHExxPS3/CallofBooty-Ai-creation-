import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Users, Server, Database, Trash2, Search, Activity, RefreshCw, UserCog, Lock, Snowflake, Ban, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc, limit, query, orderBy, updateDoc } from 'firebase/firestore';

interface AdminPanelModalProps {
  onClose: () => void;
  currentUser: any;
  onSpectateMatch?: (roomCode: string) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({ onClose, currentUser, onSpectateMatch }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'USERS' | 'SERVER' | 'LOBBIES' | 'COMMANDS'>('USERS');
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  // Overwrite Account form state
  const [editPlayerId, setEditPlayerId] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editLevel, setEditLevel] = useState('1');
  const [editXp, setEditXp] = useState('0');
  const [editKills, setEditKills] = useState('0');
  const [editDeaths, setEditDeaths] = useState('0');

  useEffect(() => {
    if (selectedUser) {
      setEditPlayerId(selectedUser.playerId || selectedUser.id || '');
      setEditUsername(selectedUser.username || '');
      setEditLevel((selectedUser.level || 1).toString());
      setEditXp((selectedUser.xp || 0).toString());
      setEditKills((selectedUser.kills || 0).toString());
      setEditDeaths((selectedUser.deaths || 0).toString());
    }
  }, [selectedUser]);

  const handleOverwriteAccount = () => {
    if (!selectedUser) return;
    const updates = {
      playerId: editPlayerId.trim(),
      username: editUsername.trim(),
      username_lowercase: editUsername.trim().toLowerCase(),
      level: parseInt(editLevel) || 1,
      xp: parseInt(editXp) || 0,
      kills: parseInt(editKills) || 0,
      deaths: parseInt(editDeaths) || 0,
    };
    handleUpdateUser(updates, `Account overwritten for ${editUsername}`);
  };


  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      // First attempt server endpoint
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setUsers(data.users);
          setLoading(false);
          return;
        }
      }
      
      // Fallback to client Firestore query
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const fetchedUsers: any[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedUsers.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsers(fetchedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('Could not fetch user list. Network error or restricted access.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLobbies = async () => {
    setLoadingLobbies(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setLobbies(data.rooms || []);
      }
    } catch (e) {
      console.warn("Failed to fetch lobbies");
    } finally {
      setLoadingLobbies(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLobbies();
  }, []);

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm(`WARNING: Are you sure you want to delete user ${id}? This action is irreversible.`)) return;
    
    try {
      // Server endpoint first
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== id));
        if (selectedUser?.id === id) setSelectedUser(null);
        alert('User account deleted successfully.');
        return;
      }
      // Fallback to client SDK
      await deleteDoc(doc(db, 'users', id));
      setUsers(users.filter(u => u.id !== id));
      if (selectedUser?.id === id) setSelectedUser(null);
      alert('User account deleted successfully.');
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('Failed to delete user. Check permissions.');
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.playerId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateUser = async (updates: any, successMessage: string) => {
    if (!selectedUser) return;
    try {
      // Try server endpoint first
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
        setSelectedUser({ ...selectedUser, ...updates });
        alert(`SUCCESS: ${successMessage}`);
        return;
      }
      
      // Fallback to client SDK
      await updateDoc(doc(db, 'users', selectedUser.id), updates);
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
      setSelectedUser({ ...selectedUser, ...updates });
      alert(`SUCCESS: ${successMessage}`);
    } catch (err) {
      console.error('Update failed:', err);
      alert('Action failed. Check permissions or network connection.');
    }
  };

  const handleBan = () => {
    if (window.confirm(selectedUser.isBanned ? 'Unban user account?' : 'Permanently ban this user account?')) {
      handleUpdateUser({ isBanned: !selectedUser.isBanned }, selectedUser.isBanned ? 'User Unbanned' : 'User Permanently Banned');
    }
  };

  const handleTempBan = () => {
    const hours = prompt("Enter temp ban duration in hours:", "24");
    if (hours) {
      const ms = parseInt(hours) * 60 * 60 * 1000;
      handleUpdateUser({ banUntil: new Date(Date.now() + ms).toISOString() }, `User temporarily banned for ${hours} hours`);
    }
  };

  const handleFreeze = () => {
    handleUpdateUser({ isFrozen: !selectedUser.isFrozen }, selectedUser.isFrozen ? 'Account unfrozen' : 'Account frozen');
  };

  const handleToggleAdminRole = () => {
    const isDev = !selectedUser.isDeveloper;
    handleUpdateUser({ isDeveloper: isDev, isAdmin: isDev }, isDev ? 'Developer/Admin Privileges Granted' : 'Developer/Admin Privileges Revoked');
  };

  const handleChangePassword = () => {
    if (passwordInput.trim().length < 4) return alert("Password too short (minimum 4 characters)");
    handleUpdateUser({ forcePasswordReset: passwordInput.trim() }, `Account Password updated to: ${passwordInput.trim()}`);
    setPasswordInput('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-5xl bg-slate-950 border-2 border-red-500/50 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.2)] overflow-hidden flex flex-col h-[85vh] font-mono">
        
        {/* Admin Header */}
        <div className="flex items-center justify-between p-4 border-b border-red-900/50 bg-red-950/20">
          <div className="flex items-center gap-4 text-red-500">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
            <div>
              <h2 className="text-xl font-black tracking-widest uppercase">Developer Admin Terminal</h2>
              <p className="text-[10px] text-red-400/80">UNRESTRICTED ACCESS LEVEL 9 GRANTED</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-b border-slate-800 bg-slate-900/30">
          <button 
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-3 text-xs font-bold tracking-widest transition flex items-center gap-2 border-b-2 ${activeTab === 'USERS' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Users className="w-4 h-4" /> USER DATABASE
          </button>
          <button 
            onClick={() => setActiveTab('SERVER')}
            className={`px-4 py-3 text-xs font-bold tracking-widest transition flex items-center gap-2 border-b-2 ${activeTab === 'SERVER' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Server className="w-4 h-4" /> SERVER STATUS
          </button>
          <button 
            onClick={() => { setActiveTab('LOBBIES'); fetchLobbies(); }}
            className={`px-4 py-3 text-xs font-bold tracking-widest transition flex items-center gap-2 border-b-2 ${activeTab === 'LOBBIES' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Activity className="w-4 h-4" /> CURRENT LOBBYS
          </button>
          <button 
            onClick={() => setActiveTab('COMMANDS')}
            className={`px-4 py-3 text-xs font-bold tracking-widest transition flex items-center gap-2 border-b-2 ${activeTab === 'COMMANDS' ? 'border-red-500 text-red-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Lock className="w-4 h-4" /> COMMAND PERMS
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-slate-900">
          
          {activeTab === 'USERS' && (
            <div className="space-y-4">
              {selectedUser ? (
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 relative">
                  <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition">
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-4 mb-6">
                    <UserCog className="w-10 h-10 text-red-500" />
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedUser.username}</h3>
                      <p className="text-sm text-slate-400 font-mono">ID: {selectedUser.playerId || selectedUser.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase flex items-center gap-2"><Ban className="w-4 h-4" /> Account Access</h4>
                        <div className="space-y-2">
                          <button onClick={handleBan} className={`w-full text-left px-4 py-2 rounded font-bold text-xs ${selectedUser.isBanned ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                            {selectedUser.isBanned ? 'UNBAN ACCOUNT' : 'PERMANENT BAN'}
                          </button>
                          <button onClick={handleTempBan} className="w-full text-left px-4 py-2 rounded font-bold text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500/30">
                            TEMPORARY BAN (HOURS)
                          </button>
                          {selectedUser.banUntil && new Date(selectedUser.banUntil) > new Date() && (
                            <p className="text-xs text-orange-400 mt-1">Banned until: {new Date(selectedUser.banUntil).toLocaleString()}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase flex items-center gap-2"><Snowflake className="w-4 h-4" /> Account Freeze</h4>
                        <p className="text-xs text-slate-500 mb-2">Freezes stats and progression.</p>
                        <button onClick={handleFreeze} className={`w-full text-left px-4 py-2 rounded font-bold text-xs ${selectedUser.isFrozen ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}>
                          {selectedUser.isFrozen ? 'UNFREEZE ACCOUNT' : 'FREEZE ACCOUNT'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <h4 className="text-sm font-bold text-slate-400 mb-2 uppercase flex items-center gap-2"><Lock className="w-4 h-4" /> Password Management</h4>
                        <p className="text-xs text-slate-500 mb-3">Set a new password or bypass password for this user account.</p>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="New password..."
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded focus:outline-none focus:border-red-500 font-mono"
                          />
                          <button onClick={handleChangePassword} className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-bold text-xs transition">
                            CHANGE PASSWORD
                          </button>
                        </div>
                        {selectedUser.forcePasswordReset && (
                          <p className="text-xs text-emerald-400 mt-2">Active password: {selectedUser.forcePasswordReset}</p>
                        )}
                      </div>

                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Admin Roles & Delete</h4>
                        
                        {/* 0419 PIN Authorization Button */}
                        {selectedUser.isRootAdmin ? (
                          <div className="p-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded text-xs font-bold text-center">
                            ⭐ MASTER ROOT ADMIN (PERMANENT PIN ACCESS)
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const nextAllowed = !selectedUser.isPinAllowed;
                              handleUpdateUser(
                                { isPinAllowed: nextAllowed },
                                nextAllowed 
                                  ? `Granted 0419 PIN authorization to ${selectedUser.username}`
                                  : `Revoked 0419 PIN authorization from ${selectedUser.username}`
                              );
                            }}
                            className={`w-full text-left px-4 py-2 rounded font-bold text-xs transition ${
                              selectedUser.isPinAllowed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {selectedUser.isPinAllowed ? '✓ 0419 PIN AUTHORIZED (REVOKE ACCESS)' : '+ GRANT 0419 PIN ACCESS'}
                          </button>
                        )}

                        <button 
                          onClick={handleToggleAdminRole} 
                          className={`w-full text-left px-4 py-2 rounded font-bold text-xs transition ${
                            selectedUser.isDeveloper || selectedUser.isAdmin 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30' 
                              : 'bg-purple-500/20 text-purple-400 border border-purple-500/40 hover:bg-purple-500/30'
                          }`}
                        >
                          {selectedUser.isDeveloper || selectedUser.isAdmin ? 'REVOKE ADMIN PRIVILEGES' : 'GRANT ADMIN PRIVILEGES'}
                        </button>

                        <button 
                          onClick={() => handleDeleteUser(selectedUser.id)} 
                          className="w-full text-left px-4 py-2 rounded font-bold text-xs bg-red-600/30 text-red-300 border border-red-500/50 hover:bg-red-600/50 transition flex items-center justify-between"
                        >
                          <span>DELETE USER PERMANENTLY</span>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Account Overwrite Card */}
                    <div className="col-span-1 md:col-span-2 p-4 bg-slate-950 rounded-lg border border-red-900/60 space-y-3">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <UserCog className="w-4 h-4 text-red-500" /> Overwrite Account Identifier & Custom Stats
                      </h4>
                      <p className="text-xs text-slate-400">Modify player ID, display name, level, or stats directly for custom testing or moderation.</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">Player ID</label>
                          <input type="text" value={editPlayerId} onChange={(e) => setEditPlayerId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">Username</label>
                          <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">Level</label>
                          <input type="number" value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">XP</label>
                          <input type="number" value={editXp} onChange={(e) => setEditXp(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">Kills</label>
                          <input type="number" value={editKills} onChange={(e) => setEditKills(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-1">Deaths</label>
                          <input type="number" value={editDeaths} onChange={(e) => setEditDeaths(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:border-red-500 font-mono" />
                        </div>
                      </div>
                      <button onClick={handleOverwriteAccount} className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs tracking-wider uppercase transition">
                        APPLY OVERWRITE ACCOUNT VALUES
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search by Username or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-10 py-2 rounded-lg focus:outline-none focus:border-red-500 w-80"
                      />
                    </div>
                    <button 
                      onClick={fetchUsers}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  </div>

                  {error ? (
                    <div className="p-4 bg-red-950/50 border border-red-500/50 text-red-400 text-sm rounded-lg">
                      [!] {error}
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3 font-medium">Player ID</th>
                            <th className="px-4 py-3 font-medium">Username</th>
                            <th className="px-4 py-3 font-medium">Level / XP</th>
                            <th className="px-4 py-3 font-medium">K/D</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {loading && users.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500">Querying database...</td></tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-8 text-slate-500">No records found.</td></tr>
                          ) : (
                            filteredUsers.map((u) => {
                              const kd = u.deaths > 0 ? (u.kills / u.deaths).toFixed(2) : u.kills?.toString() || '0.00';
                              return (
                                <tr key={u.id} onClick={() => setSelectedUser(u)} className="hover:bg-slate-800/50 transition cursor-pointer">
                                  <td className="px-4 py-3 text-slate-500 font-bold">{u.playerId || u.id.slice(0,8)}</td>
                                  <td className="px-4 py-3 text-slate-200">
                                    {u.username} 
                                    {u.isGuest && <span className="ml-2 text-[8px] bg-slate-700 px-1 py-0.5 rounded text-slate-400">GUEST</span>}
                                  </td>
                                  <td className="px-4 py-3 text-emerald-400 font-bold">Lvl {u.level || 1} <span className="text-slate-500 font-normal">({u.xp || 0} XP)</span></td>
                                  <td className="px-4 py-3 text-slate-300">{kd}</td>
                                  <td className="px-4 py-3">
                                    {u.isRootAdmin && <span className="text-[10px] bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded mr-1 font-bold">ROOT ADMIN</span>}
                                    {u.isPinAllowed && !u.isRootAdmin && <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded mr-1 font-bold">0419 PIN PERMITTED</span>}
                                    {u.isBanned && <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded mr-1 font-bold">BANNED</span>}
                                    {u.isFrozen && <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded mr-1 font-bold">FROZEN</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                                    {!u.isRootAdmin && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const next = !u.isPinAllowed;
                                          try {
                                            await updateDoc(doc(db, 'users', u.id), { isPinAllowed: next });
                                            setUsers(prev => prev.map(p => p.id === u.id ? { ...p, isPinAllowed: next } : p));
                                            if (selectedUser?.id === u.id) setSelectedUser({ ...selectedUser, isPinAllowed: next });
                                          } catch (err) {
                                            console.error("Failed to toggle 0419 PIN:", err);
                                          }
                                        }}
                                        className={`px-2 py-1 rounded text-[10px] font-bold transition border ${
                                          u.isPinAllowed
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                                        }`}
                                        title="Toggle 0419 PIN Keypad Permission"
                                      >
                                        {u.isPinAllowed ? '🔑 0419 PIN: ALLOWED' : '🔒 0419 PIN: DENIED'}
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }}
                                      className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
                                      title="Delete User Data"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'SERVER' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Activity className="w-4 h-4" /> Real-time Telemetry
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">API Status</span>
                    <span className="text-emerald-400 font-bold">ONLINE (12ms)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Active WebSocket Connections</span>
                    <span className="text-white font-bold">0</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Active Lobbies</span>
                    <span className="text-white font-bold">1 (Local)</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Database Read/Write (1m)</span>
                    <span className="text-white font-bold">45 / 12</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4 flex flex-col items-center justify-center text-center">
                 <Database className="w-12 h-12 text-slate-700" />
                 <p className="text-xs text-slate-500 max-w-xs">
                   More advanced telemetry and matchmaking coordination metrics are currently isolated in the backend service.
                 </p>
              </div>
            </div>
          )}
          
          {activeTab === 'LOBBIES' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-300">Active Multiplayer Lobbies</h3>
                <button 
                  onClick={fetchLobbies}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingLobbies ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loadingLobbies ? (
                <div className="text-center py-8 text-slate-500">Querying active sessions...</div>
              ) : lobbies.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">No active multiplayer lobbies found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lobbies.map(room => (
                    <div key={room.code} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-md font-bold text-white uppercase tracking-wider">{room.name}</h4>
                          <span className="text-[10px] bg-red-950 text-red-400 font-mono px-2 py-0.5 rounded border border-red-900">ID: {room.code}</span>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1 font-mono mb-4">
                          <p>Map: <span className="text-slate-300">{room.mapId}</span></p>
                          <p>Host: <span className="text-slate-300">{room.hostId.slice(0, 8)}...</span></p>
                          <p>Players: <span className="text-emerald-400">{room.playerCount}</span> / {room.botCount} Bots</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (onSpectateMatch) {
                            onSpectateMatch(room.code);
                            onClose();
                          }
                        }}
                        className="w-full bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 py-2 rounded text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        <Eye className="w-4 h-4" /> INVISIBLE SPECTATE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'COMMANDS' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-300">Command Permissions</h3>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <p className="text-xs text-slate-500 max-w-lg mb-4">
                  Enable or disable access to developer menus. By default, these menus are hidden from standard players.
                </p>
                <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg">
                  <div>
                    <h4 className="text-sm font-bold text-white">Personal Calibration Menu (Key 7)</h4>
                    <p className="text-[10px] text-slate-500">Allows modifying local player attributes like FOV and tactical overlays.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const enabled = localStorage.getItem('cmd_perm_7') === 'true';
                      localStorage.setItem('cmd_perm_7', enabled ? 'false' : 'true');
                      // force re-render by doing nothing, but in react we need a state update to show the change
                      setLoadingLobbies(!loadingLobbies); // hacky re-render
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded uppercase transition ${localStorage.getItem('cmd_perm_7') === 'true' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-500'}`}
                  >
                    {localStorage.getItem('cmd_perm_7') === 'true' ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-lg">
                  <div>
                    <h4 className="text-sm font-bold text-white">Tactical Override Menu (Key 8)</h4>
                    <p className="text-[10px] text-slate-500">Allows modifying other players' operational variables in the lobby.</p>
                  </div>
                  <button 
                    onClick={() => {
                      const enabled = localStorage.getItem('cmd_perm_8') === 'true';
                      localStorage.setItem('cmd_perm_8', enabled ? 'false' : 'true');
                      setLoadingLobbies(!loadingLobbies); // hacky re-render
                    }}
                    className={`px-4 py-2 text-xs font-bold rounded uppercase transition ${localStorage.getItem('cmd_perm_8') === 'true' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-slate-800 text-slate-500'}`}
                  >
                    {localStorage.getItem('cmd_perm_8') === 'true' ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};
