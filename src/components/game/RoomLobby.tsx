import { useState } from 'react';
import type { GameRoom, Player, GameVersion, AISkillLevel } from '@/types/game';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Users, Globe, Check, Copy, LogOut, Play, Bot, Crown, Plus, Minus } from 'lucide-react';

interface RoomLobbyProps {
  room: GameRoom;
  currentPlayer: Player;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onAddAI?: (aiSkillLevel: AISkillLevel) => void;
  onRemoveAI?: (aiPlayerId: string) => void;
}

// Car avatars for players
const CAR_AVATARS = ['🏎️', '🚗', '🚙', '🚐', '🚕'];
const CAR_GRADIENTS = [
  'from-red-500 to-orange-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-amber-500',
  'from-purple-500 to-pink-500',
];

export function RoomLobby({
  room,
  currentPlayer,
  onStartGame,
  onLeaveRoom,
  onToggleReady,
  onAddAI,
  onRemoveAI,
}: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [aiSkillLevel, setAiSkillLevel] = useState<AISkillLevel>('medium');
  const isHost = currentPlayer.isHost;
  const realPlayers = room.players.filter(p => !p.isAI);
  const aiPlayers = room.players.filter(p => p.isAI);
  const allReady = realPlayers.every(p => p.isReady || p.isHost);
  const canStart = room.players.length >= 2 && allReady;
  const canAddAI = room.players.length < 5;
  const needsMorePlayers = room.players.length < 2;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(room.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getVersionFlag = (version: GameVersion) => {
    switch (version) {
      case 'us': return '🇺🇸';
      case 'uk': return '🇬🇧';
      case 'india': return '🇮🇳';
      default: return '🌍';
    }
  };

  const getVersionName = (version: GameVersion) => {
    switch (version) {
      case 'us': return 'US Edition';
      case 'uk': return 'UK Edition';
      case 'india': return 'India Edition';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden relative z-10">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl sm:text-2xl">🏎️</span>
                <h1 className="text-lg sm:text-2xl font-black tracking-tight">GAME LOBBY</h1>
              </div>
              <p className="text-white/80 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Globe className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                {getVersionFlag(room.version)} {getVersionName(room.version)}
                {room.mode === 'single' && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs hidden sm:inline">Single Player</span>
                )}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl sm:text-4xl font-mono font-black tracking-wider bg-white/20 rounded-xl px-2 sm:px-4 py-1 sm:py-2">{room.id}</div>
              <p className="text-white/60 text-xs mt-1 uppercase tracking-wider">Room Code</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* Room code copy */}
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 mb-6 flex items-center justify-between border border-gray-200">
            <div>
              <p className="text-sm text-gray-600 font-medium">Share this code with friends</p>
              <p className="text-xs text-gray-400">They can join using this room code</p>
            </div>
            <Button 
              onClick={copyRoomCode}
              variant="outline"
              className={cn(
                'flex items-center gap-2 transition-all',
                copied && 'bg-green-100 border-green-300 text-green-700'
              )}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </div>

          {/* Add AI Players (Host Only) */}
          {isHost && room.mode !== 'single' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Add AI Players</p>
                    <p className="text-sm text-gray-500">
                      {needsMorePlayers
                        ? `Need ${2 - room.players.length} more player(s) to start`
                        : 'Add AI to fill empty spots'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{aiPlayers.length} AI</span>
                  {canAddAI && onAddAI && (
                    <Button
                      onClick={() => onAddAI(aiSkillLevel)}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="w-4 h-4" />
                      Add AI
                    </Button>
                  )}
                </div>
              </div>

              {/* AI Skill Level Selector */}
              <div className="flex gap-2 mb-3">
                {([
                  { value: 'beginner', label: '🐣 Beginner' },
                  { value: 'medium',   label: '🤖 Medium'   },
                  { value: 'advanced', label: '🏆 Advanced' },
                ] as { value: AISkillLevel; label: string }[]).map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setAiSkillLevel(s.value)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg border-2 text-xs font-medium transition-all',
                      aiSkillLevel === s.value
                        ? 'border-blue-500 bg-blue-100 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* AI Player List with Remove Buttons */}
              {aiPlayers.length > 0 && onRemoveAI && (
                <div className="flex flex-wrap gap-2">
                  {aiPlayers.map((ai) => (
                    <div key={ai.id} className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border">
                      <Bot className="w-3 h-3 text-blue-500" />
                      <span className="text-sm">{ai.name}</span>
                      {ai.aiSkill && (
                        <span className="text-[10px] text-gray-400 ml-0.5">
                          ({ai.aiSkill === 'beginner' ? '🐣' : ai.aiSkill === 'advanced' ? '🏆' : '🤖'})
                        </span>
                      )}
                      <button
                        onClick={() => onRemoveAI(ai.id)}
                        className="ml-1 text-red-500 hover:text-red-700 p-1"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Players list */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-800">
                Players ({room.players.length}/5)
              </h2>
              {aiPlayers.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Bot className="w-3 h-3" /> {aiPlayers.length} AI
                </span>
              )}
            </div>

            <div className="space-y-2">
              {room.players.map((player, index) => (
                <div 
                  key={player.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl border-2 transition-all',
                    player.id === currentPlayer.id 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-gray-50 border-gray-200',
                    player.isAI && 'bg-purple-50 border-purple-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Car Avatar */}
                    <div className={cn(
                      'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl shadow-md',
                      CAR_GRADIENTS[index % CAR_GRADIENTS.length]
                    )}>
                      {player.isAI ? <Bot className="w-6 h-6 text-white" /> : CAR_AVATARS[index % CAR_AVATARS.length]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 flex items-center gap-2">
                        {player.name}
                        {player.id === currentPlayer.id && (
                          <span className="text-blue-500 text-xs bg-blue-100 px-2 py-0.5 rounded-full">You</span>
                        )}
                        {player.isHost && (
                          <span className="text-red-500 text-xs bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Host
                          </span>
                        )}
                        {player.isAI && (
                          <span className="text-purple-500 text-xs bg-purple-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Bot className="w-3 h-3" /> AI
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {player.isReady ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium bg-green-100 px-3 py-1 rounded-full">
                        <Check className="w-4 h-4" /> Ready
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm bg-gray-100 px-3 py-1 rounded-full">
                        Waiting...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button 
              onClick={onLeaveRoom}
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2 h-12"
            >
              <LogOut className="w-4 h-4" />
              Leave
            </Button>

            {!isHost && !currentPlayer.isAI && (
              <Button 
                onClick={onToggleReady}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-12',
                  currentPlayer.isReady 
                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                    : 'bg-green-500 hover:bg-green-600'
                )}
              >
                <Check className="w-4 h-4" />
                {currentPlayer.isReady ? 'Not Ready' : 'I\'m Ready'}
              </Button>
            )}

            {isHost && (
              <Button 
                onClick={onStartGame}
                disabled={!canStart}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-12',
                  canStart 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-500/30' 
                    : 'bg-gray-300 cursor-not-allowed'
                )}
              >
                <Play className="w-4 h-4" />
                Start Game
              </Button>
            )}
          </div>

          {!canStart && isHost && (
            <p className="text-center text-sm text-gray-500 mt-3">
              {needsMorePlayers 
                ? `Need at least ${2 - room.players.length} more player(s). Add AI or wait for friends!`
                : 'Waiting for all players to be ready'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default RoomLobby;
