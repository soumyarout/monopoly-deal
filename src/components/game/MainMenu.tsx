import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import type { GameVersion } from '@/types/game';
import { cn } from '@/lib/utils';
import { Plus, LogIn, Users, Globe, Gamepad2, Bot, User, Eye } from 'lucide-react';

interface MainMenuProps {
  onCreateRoom: (playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit?: number) => void;
  onJoinRoom: (playerName: string, roomCode: string) => void;
  onWatchRoom: (playerName: string, roomCode: string) => void;
  connected?: boolean;
}

const TIMER_OPTIONS = [
  { value: 30,  label: '30s' },
  { value: 60,  label: '1 min' },
  { value: 90,  label: '1m 30s' },
  { value: 120, label: '2 min' },
  { value: 0,   label: '∞ No limit' },
];

export function MainMenu({ onCreateRoom, onJoinRoom, onWatchRoom, connected = true }: MainMenuProps) {
  const [mode, setMode] = useState<'menu' | 'create-single' | 'create-multi' | 'join' | 'watch'>('menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [version, setVersion] = useState<GameVersion>('us');
  const [aiCount, setAiCount] = useState(3);
  const [turnTimeLimit, setTurnTimeLimit] = useState(60);
  const [error, setError] = useState('');

  const handleCreateRoom = (gameMode: 'single' | 'multi') => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    onCreateRoom(playerName.trim(), version, gameMode, gameMode === 'single' ? aiCount : undefined, turnTimeLimit);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter room code');
      return;
    }
    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  const handleWatchRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter room code');
      return;
    }
    onWatchRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8 text-center relative z-10">
          {/* Logo with Car Theme */}
          <div className="mb-8">
            <div className="w-28 h-28 mx-auto bg-gradient-to-br from-red-600 via-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl mb-4 transform hover:scale-105 transition-transform">
              <span className="text-6xl">🏎️</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-800 tracking-tight">MONOPOLY</h1>
            <p className="text-red-500 font-bold text-lg sm:text-xl tracking-widest">DEAL</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-2xl">🎴</span>
              <span className="text-gray-500 text-sm">Multiplayer Card Game</span>
              <span className="text-2xl">💰</span>
            </div>
            
            {/* Connection Status */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              )} />
              <span className={cn(
                'text-xs font-medium',
                connected ? 'text-green-600' : 'text-red-600'
              )}>
                {connected ? 'Server Connected' : 'Server Disconnected'}
              </span>
            </div>
          </div>

          {/* Menu buttons */}
          <div className="space-y-3">
            <Button 
              onClick={() => setMode('create-single')}
              className="w-full h-16 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white flex items-center justify-center gap-3 shadow-lg shadow-green-500/30"
            >
              <Bot className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">Single Player</div>
                <div className="text-xs opacity-80">Play against AI</div>
              </div>
            </Button>
            
            <Button 
              onClick={() => setMode('create-multi')}
              className="w-full h-16 text-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white flex items-center justify-center gap-3 shadow-lg shadow-blue-500/30"
            >
              <Users className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">Multiplayer</div>
                <div className="text-xs opacity-80">Play with friends</div>
              </div>
            </Button>
            
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full h-14 text-lg border-2 border-purple-500 text-purple-600 hover:bg-purple-50 flex items-center justify-center gap-3"
            >
              <LogIn className="w-5 h-5" />
              Join Room
            </Button>

            <Button
              onClick={() => setMode('watch')}
              variant="outline"
              className="w-full h-12 text-base border-2 border-blue-400 text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-3"
            >
              <Eye className="w-5 h-5" />
              Watch Game
            </Button>
          </div>

          {/* Game info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" /> 2-5 Players
              </span>
              <span className="flex items-center gap-1">
                <Gamepad2 className="w-4 h-4" /> Real-time
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create-single') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8">
          <button 
            onClick={() => { setMode('menu'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Single Player</h2>
              <p className="text-gray-500 text-sm">Play against AI opponents</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-medium">
                <User className="w-4 h-4 inline mr-1" />
                Your Name
              </Label>
              <Input
                id="name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="mt-2 h-12"
                maxLength={20}
              />
            </div>

            <div>
              <Label className="text-gray-700 font-medium mb-3 block">
                <Globe className="w-4 h-4 inline mr-1" />
                Game Version
              </Label>
              <RadioGroup 
                value={version} 
                onValueChange={(v) => setVersion(v as GameVersion)}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'us', flag: '🇺🇸', name: 'US' },
                  { value: 'uk', flag: '🇬🇧', name: 'UK' },
                  { value: 'india', flag: '🇮🇳', name: 'India' },
                ].map((v) => (
                  <div key={v.value}>
                    <RadioGroupItem value={v.value} id={v.value} className="peer sr-only" />
                    <Label
                      htmlFor={v.value}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all',
                        'hover:border-blue-300 hover:bg-blue-50',
                        'peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50'
                      )}
                    >
                      <span className="text-2xl mb-1">{v.flag}</span>
                      <span className="text-sm font-medium">{v.name}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-gray-700 font-medium mb-3 block">
                ⏱ Turn Timer
              </Label>
              <div className="flex flex-wrap gap-2">
                {TIMER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTurnTimeLimit(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all',
                      turnTimeLimit === opt.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-gray-700 font-medium mb-3 block">
                <Bot className="w-4 h-4 inline mr-1" />
                AI Opponents: {aiCount}
              </Label>
              <Slider
                value={[aiCount]}
                onValueChange={(value) => setAiCount(value[0])}
                min={1}
                max={4}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>1 AI</span>
                <span>4 AI</span>
              </div>
            </div>

            <Button 
              onClick={() => handleCreateRoom('single')}
              className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg"
            >
              <Gamepad2 className="w-5 h-5 mr-2" />
              Start Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create-multi') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8">
          <button 
            onClick={() => { setMode('menu'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Multiplayer</h2>
              <p className="text-gray-500 text-sm">Create a room for friends</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <Label htmlFor="name" className="text-gray-700 font-medium">
                <User className="w-4 h-4 inline mr-1" />
                Your Name
              </Label>
              <Input
                id="name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="mt-2 h-12"
                maxLength={20}
              />
            </div>

            <div>
              <Label className="text-gray-700 font-medium mb-3 block">
                <Globe className="w-4 h-4 inline mr-1" />
                Game Version
              </Label>
              <RadioGroup 
                value={version} 
                onValueChange={(v) => setVersion(v as GameVersion)}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'us', flag: '🇺🇸', name: 'US' },
                  { value: 'uk', flag: '🇬🇧', name: 'UK' },
                  { value: 'india', flag: '🇮🇳', name: 'India' },
                ].map((v) => (
                  <div key={v.value}>
                    <RadioGroupItem value={v.value} id={v.value} className="peer sr-only" />
                    <Label
                      htmlFor={v.value}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all',
                        'hover:border-blue-300 hover:bg-blue-50',
                        'peer-data-[state=checked]:border-blue-500 peer-data-[state=checked]:bg-blue-50'
                      )}
                    >
                      <span className="text-2xl mb-1">{v.flag}</span>
                      <span className="text-sm font-medium">{v.name}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-gray-700 font-medium mb-3 block">
                ⏱ Turn Timer
              </Label>
              <div className="flex flex-wrap gap-2">
                {TIMER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTurnTimeLimit(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all',
                      turnTimeLimit === opt.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => handleCreateRoom('multi')}
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8">
          <button 
            onClick={() => { setMode('menu'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <LogIn className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Join Room</h2>
              <p className="text-gray-500 text-sm">Enter room code to join</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <Label htmlFor="join-name" className="text-gray-700 font-medium">
                <User className="w-4 h-4 inline mr-1" />
                Your Name
              </Label>
              <Input
                id="join-name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="mt-2 h-12"
                maxLength={20}
              />
            </div>

            <div>
              <Label htmlFor="room-code" className="text-gray-700 font-medium">
                Room Code
              </Label>
              <Input
                id="room-code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="mt-2 h-12 text-center text-2xl tracking-widest font-mono uppercase"
                maxLength={8}
              />
            </div>

            <Button
              onClick={handleJoinRoom}
              className="w-full h-14 text-lg bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Join Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'watch') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8">
          <button
            onClick={() => { setMode('menu'); setError(''); }}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Watch Game</h2>
              <p className="text-gray-500 text-sm">Join as a spectator</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <Label htmlFor="watch-name" className="text-gray-700 font-medium">
                <User className="w-4 h-4 inline mr-1" />
                Your Name
              </Label>
              <Input
                id="watch-name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="mt-2 h-12"
                maxLength={20}
              />
            </div>

            <div>
              <Label htmlFor="watch-code" className="text-gray-700 font-medium">
                Room Code
              </Label>
              <Input
                id="watch-code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="mt-2 h-12 text-center text-2xl tracking-widest font-mono uppercase"
                maxLength={8}
              />
            </div>

            <Button
              onClick={handleWatchRoom}
              className="w-full h-14 text-lg bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg"
            >
              <Eye className="w-5 h-5 mr-2" />
              Watch Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default MainMenu;
