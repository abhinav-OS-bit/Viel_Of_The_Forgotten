
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sword, Heart, Droplet, Zap, Crown, X } from 'lucide-react';

const VeilOfTheForgotten = () => {
  const canvasRef = useRef(null);
  const [gameState, setGameState] = useState('menu'); // menu, playing, paused, dead, upgrade
  const [score, setScore] = useState(0);
  const [distance, setDistance] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [essenceBank, setEssenceBank] = useState(0);
  
  // Player upgrades
  const [upgrades, setUpgrades] = useState({
    maxHealth: 5,
    jumpBoost: 0,
    dashCharges: 1,
    essenceMagnet: 1,
    damageBoost: 0,
    revival: false
  });

  const gameRef = useRef({
    player: {
      x: 150,
      y: 300,
      vx: 0,
      vy: 0,
      width: 24,
      height: 36,
      health: 5,
      maxHealth: 5,
      essence: 0,
      grounded: false,
      wallSliding: false,
      wallSide: 0,
      canDash: true,
      dashCharges: 1,
      dashCooldown: 0,
      attacking: false,
      attackCooldown: 0,
      invulnerable: 0,
      combo: 0,
      lastComboTime: 0
    },
    camera: { x: 0 },
    platforms: [],
    enemies: [],
    particles: [],
    collectibles: [],
    biome: 0,
    biomeProgress: 0,
    gameSpeed: 1,
    scrollSpeed: 3,
    spawnTimer: 0,
    bossChase: false,
    bossX: -200,
    lastTime: Date.now(),
    keys: {}
  });

  const BIOMES = [
    { name: 'Fungal Sprawl', color: '#4a1f5f', accent: '#00ffaa', glow: '#8b5cf6' },
    { name: 'Crystalline Catacombs', color: '#1a2332', accent: '#60a5fa', glow: '#93c5fd' },
    { name: 'Clockwork Sepulcher', color: '#2d1810', accent: '#f59e0b', glow: '#fbbf24' },
    { name: 'Molten Hive', color: '#1f0a0a', accent: '#ef4444', glow: '#fb923c' }
  ];

  const generatePlatform = useCallback((startX) => {
    const game = gameRef.current;
    const biome = Math.floor(game.biomeProgress / 1000) % BIOMES.length;
    const difficulty = Math.min(game.biomeProgress / 500, 5);
    
    const types = ['normal', 'floating', 'moving', 'crumbling', 'spike'];
    const weights = biome === 0 ? [5, 3, 1, 1, 2] : [3, 3, 2, 2, 3];
    
    let totalWeight = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    let type = 'normal';
    
    for (let i = 0; i < types.length; i++) {
      rand -= weights[i];
      if (rand <= 0) {
        type = types[i];
        break;
      }
    }
    
    const gapSize = 80 + Math.random() * (100 + difficulty * 20);
    const y = 400 + (Math.random() - 0.5) * 150;
    const width = 100 + Math.random() * 150;
    
    return {
      x: startX + gapSize,
      y: y,
      width: width,
      height: 20,
      type: type,
      health: type === 'crumbling' ? 60 : -1,
      moveSpeed: type === 'moving' ? (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()) : 0,
      moveRange: 100,
      startY: y
    };
  }, []);

  const spawnEnemy = useCallback((x) => {
    const game = gameRef.current;
    const biome = Math.floor(game.biomeProgress / 1000) % BIOMES.length;
    const difficulty = Math.min(game.biomeProgress / 500, 3);
    
    const types = [
      { type: 'sentry', hp: 2, speed: 0.5, size: 30, worth: 10 },
      { type: 'wasp', hp: 1, speed: 2, size: 20, worth: 5 },
      { type: 'crawler', hp: 3, speed: 1, size: 25, worth: 15 },
      { type: 'wisp', hp: 1, speed: 1.5, size: 22, worth: 20 }
    ];
    
    const enemyType = types[Math.floor(Math.random() * Math.min(types.length, 2 + biome))];
    
    return {
      ...enemyType,
      x: x,
      y: 250 + Math.random() * 200,
      vx: -enemyType.speed * (1 + difficulty * 0.3),
      vy: enemyType.type === 'wasp' ? Math.sin(Date.now() / 300) * 2 : 0,
      hp: enemyType.hp,
      maxHp: enemyType.hp,
      attacking: false,
      attackCooldown: 0,
      phase: 0
    };
  }, []);

  const spawnCollectible = useCallback((x, y, type = 'essence') => {
    return {
      x, y,
      type,
      size: type === 'essence' ? 10 : 15,
      collected: false,
      float: Math.random() * Math.PI * 2,
      worth: type === 'essence' ? 5 : 0
    };
  }, []);

  const createParticles = useCallback((x, y, count, color, speed = 3) => {
    const game = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      game.particles.push({
        x, y,
        vx: Math.cos(angle) * speed * (0.5 + Math.random()),
        vy: Math.sin(angle) * speed * (0.5 + Math.random()),
        life: 30 + Math.random() * 30,
        maxLife: 30 + Math.random() * 30,
        color,
        size: 2 + Math.random() * 4
      });
    }
  }, []);

  const initGame = useCallback(() => {
    const game = gameRef.current;
    const maxHealth = upgrades.maxHealth;
    
    game.player = {
      x: 150, y: 300, vx: 0, vy: 0,
      width: 24, height: 36,
      health: maxHealth, maxHealth: maxHealth,
      essence: 0, grounded: false,
      wallSliding: false, wallSide: 0,
      canDash: true, dashCharges: upgrades.dashCharges,
      dashCooldown: 0, attacking: false,
      attackCooldown: 0, invulnerable: 0,
      combo: 0, lastComboTime: 0
    };
    
    game.camera = { x: 0 };
    game.platforms = [];
    game.enemies = [];
    game.particles = [];
    game.collectibles = [];
    game.biome = 0;
    game.biomeProgress = 0;
    game.scrollSpeed = 3;
    game.spawnTimer = 0;
    game.bossChase = false;
    game.bossX = -200;
    
    // Generate initial platforms
    let lastX = -100;
    for (let i = 0; i < 20; i++) {
      const platform = generatePlatform(lastX);
      game.platforms.push(platform);
      lastX = platform.x;
    }
    
    setScore(0);
    setDistance(0);
    setGameState('playing');
  }, [generatePlatform, upgrades]);

  const handlePlayerInput = useCallback(() => {
    const game = gameRef.current;
    const player = game.player;
    const keys = game.keys;
    
    // Horizontal movement
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      player.vx = Math.max(player.vx - 0.8, -5);
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      player.vx = Math.min(player.vx + 0.8, 5);
    } else {
      player.vx *= 0.85;
    }
    
    // Jump
    if ((keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' ']) && !keys.jumpPressed) {
      keys.jumpPressed = true;
      if (player.grounded) {
        player.vy = -12 - upgrades.jumpBoost * 1.5;
        player.grounded = false;
        createParticles(player.x + player.width / 2, player.y + player.height, 5, '#8b5cf6', 2);
      } else if (player.wallSliding) {
        player.vy = -11 - upgrades.jumpBoost * 1.5;
        player.vx = player.wallSide * 8;
        player.wallSliding = false;
        createParticles(player.x + player.width / 2, player.y + player.height / 2, 8, '#60a5fa', 3);
      }
    }
    
    if (!(keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' '])) {
      keys.jumpPressed = false;
    }
    
    // Dash
    if ((keys['Shift'] || keys['x'] || keys['X']) && !keys.dashPressed && player.dashCharges > 0 && player.dashCooldown <= 0) {
      keys.dashPressed = true;
      player.dashCharges--;
      player.dashCooldown = 45;
      player.vx = (keys['ArrowLeft'] || keys['a'] || keys['A']) ? -15 : 15;
      player.vy = 0;
      player.invulnerable = 15;
      createParticles(player.x + player.width / 2, player.y + player.height / 2, 15, '#00ffaa', 4);
    }
    
    if (!(keys['Shift'] || keys['x'] || keys['X'])) {
      keys.dashPressed = false;
    }
    
    // Attack
    if ((keys['z'] || keys['Z'] || keys['Control']) && !keys.attackPressed && player.attackCooldown <= 0) {
      keys.attackPressed = true;
      player.attacking = true;
      player.attackCooldown = 20;
      createParticles(player.x + player.width / 2, player.y + player.height / 2, 8, '#ffffff', 3);
    }
    
    if (!(keys['z'] || keys['Z'] || keys['Control'])) {
      keys.attackPressed = false;
    }
  }, [createParticles, upgrades]);

  const updatePhysics = useCallback(() => {
    const game = gameRef.current;
    const player = game.player;
    
    // Gravity
    if (!player.grounded && !player.wallSliding) {
      player.vy += 0.6;
      player.vy = Math.min(player.vy, 15);
    }
    
    // Wall sliding
    if (player.wallSliding) {
      player.vy = Math.min(player.vy, 2);
    }
    
    // Apply velocity
    player.x += player.vx;
    player.y += player.vy;
    
    // Reset ground state
    player.grounded = false;
    player.wallSliding = false;
    
    // Platform collision
    game.platforms.forEach(platform => {
      if (player.x + player.width > platform.x &&
          player.x < platform.x + platform.width) {
        
        // Top collision
        if (player.y + player.height > platform.y &&
            player.y + player.height < platform.y + 20 &&
            player.vy >= 0) {
          player.y = platform.y - player.height;
          player.vy = 0;
          player.grounded = true;
          player.dashCharges = upgrades.dashCharges;
          
          // Crumbling platform
          if (platform.type === 'crumbling' && platform.health > 0) {
            platform.health--;
          }
        }
        
        // Bottom collision
        if (player.y < platform.y + platform.height &&
            player.y > platform.y &&
            player.vy < 0) {
          player.y = platform.y + platform.height;
          player.vy = 0;
        }
      }
      
      // Wall collision for wall jump
      if (player.y + player.height > platform.y &&
          player.y < platform.y + platform.height &&
          !player.grounded) {
        
        if (player.x + player.width > platform.x &&
            player.x + player.width < platform.x + 20 &&
            player.vx > 0) {
          player.x = platform.x - player.width;
          player.wallSliding = true;
          player.wallSide = -1;
        }
        
        if (player.x < platform.x + platform.width &&
            player.x > platform.x + platform.width - 20 &&
            player.vx < 0) {
          player.x = platform.x + platform.width;
          player.wallSliding = true;
          player.wallSide = 1;
        }
      }
    });
    
    // Bounds
    if (player.y > 650) {
      player.health = 0;
    }
    
    player.x = Math.max(game.camera.x - 100, Math.min(player.x, game.camera.x + 700));
  }, [upgrades]);

  const updateGame = useCallback(() => {
    const game = gameRef.current;
    const player = game.player;
    const now = Date.now();
    const dt = Math.min((now - game.lastTime) / 16.67, 2);
    game.lastTime = now;
    
    if (gameState !== 'playing') return;
    
    // Update timers
    if (player.dashCooldown > 0) player.dashCooldown--;
    if (player.attackCooldown > 0) player.attackCooldown--;
    if (player.invulnerable > 0) player.invulnerable--;
    if (player.attacking && player.attackCooldown <= 0) player.attacking = false;
    
    // Combo timer
    if (now - player.lastComboTime > 3000) {
      player.combo = 0;
    }
    
    // Handle input
    handlePlayerInput();
    
    // Update physics
    updatePhysics();
    
    // Camera follows player
    game.camera.x = player.x - 200;
    
    // Scroll speed increases with distance
    game.scrollSpeed = 3 + Math.min(game.biomeProgress / 1000, 4);
    
    // Update platforms
    game.platforms = game.platforms.filter(p => p.x > game.camera.x - 200);
    game.platforms.forEach(platform => {
      // Moving platforms
      if (platform.type === 'moving') {
        platform.y += platform.moveSpeed;
        if (Math.abs(platform.y - platform.startY) > platform.moveRange) {
          platform.moveSpeed *= -1;
        }
      }
      
      // Crumbling platforms
      if (platform.type === 'crumbling' && platform.health === 0) {
        platform.y += 5;
      }
    });
    
    // Generate new platforms
    if (game.platforms.length < 20) {
      const lastPlatform = game.platforms[game.platforms.length - 1];
      const newPlatform = generatePlatform(lastPlatform.x);
      game.platforms.push(newPlatform);
      
      // Spawn collectibles on platforms
      if (Math.random() < 0.3) {
        game.collectibles.push(spawnCollectible(
          newPlatform.x + Math.random() * newPlatform.width,
          newPlatform.y - 30,
          'essence'
        ));
      }
      
      if (Math.random() < 0.05) {
        game.collectibles.push(spawnCollectible(
          newPlatform.x + Math.random() * newPlatform.width,
          newPlatform.y - 30,
          'health'
        ));
      }
    }
    
    // Spawn enemies
    game.spawnTimer--;
    if (game.spawnTimer <= 0) {
      const spawnDelay = Math.max(60 - game.biomeProgress / 50, 20);
      game.spawnTimer = spawnDelay;
      game.enemies.push(spawnEnemy(game.camera.x + 900));
    }
    
    // Update enemies
    game.enemies = game.enemies.filter(e => e.x > game.camera.x - 100 && e.hp > 0);
    game.enemies.forEach(enemy => {
      enemy.x += enemy.vx;
      
      if (enemy.type === 'wasp') {
        enemy.phase += 0.1;
        enemy.y += Math.sin(enemy.phase) * 0.5;
        
        // Dive attack
        if (Math.abs(enemy.x - player.x) < 150 && !enemy.attacking) {
          enemy.attacking = true;
          enemy.vx = (player.x - enemy.x) / 30;
          enemy.vy = (player.y - enemy.y) / 30;
        }
        
        if (enemy.attacking) {
          enemy.y += enemy.vy;
        }
      }
      
      if (enemy.type === 'crawler') {
        enemy.attackCooldown--;
        if (enemy.attackCooldown <= 0 && Math.abs(enemy.x - player.x) < 200) {
          enemy.attackCooldown = 90;
          // Spawn projectile
          createParticles(enemy.x, enemy.y, 3, '#10b981', 1);
        }
      }
      
      // Enemy collision with player
      if (player.invulnerable <= 0) {
        const dx = player.x + player.width / 2 - enemy.x;
        const dy = player.y + player.height / 2 - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < (player.width + enemy.size) / 2) {
          if (player.attacking) {
            enemy.hp--;
            player.combo++;
            player.lastComboTime = now;
            setScore(s => s + 50 * (1 + player.combo * 0.1));
            createParticles(enemy.x, enemy.y, 10, '#ef4444', 4);
            
            if (enemy.hp <= 0) {
              setScore(s => s + enemy.worth * 10);
              player.essence += enemy.worth;
              createParticles(enemy.x, enemy.y, 15, '#00ffaa', 5);
            }
          } else {
            player.health--;
            player.invulnerable = 60;
            player.combo = 0;
            createParticles(player.x + player.width / 2, player.y + player.height / 2, 20, '#ef4444', 6);
          }
        }
      }
    });
    
    // Update collectibles
    game.collectibles = game.collectibles.filter(c => c.x > game.camera.x - 100 && !c.collected);
    game.collectibles.forEach(col => {
      col.float += 0.1;
      col.y += Math.sin(col.float) * 0.5;
      
      const magnetRange = 50 * upgrades.essenceMagnet;
      const dx = player.x + player.width / 2 - col.x;
      const dy = player.y + player.height / 2 - col.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < magnetRange) {
        col.x += dx * 0.1;
        col.y += dy * 0.1;
      }
      
      if (dist < 30) {
        col.collected = true;
        if (col.type === 'essence') {
          player.essence += col.worth;
          setScore(s => s + col.worth);
        } else if (col.type === 'health') {
          player.health = Math.min(player.health + 1, player.maxHealth);
        }
        createParticles(col.x, col.y, 8, col.type === 'essence' ? '#00ffaa' : '#ef4444', 3);
      }
    });
    
    // Update particles
    game.particles = game.particles.filter(p => p.life > 0);
    game.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
    });
    
    // Boss chase event
    game.biomeProgress = Math.floor(distance);
    if (game.biomeProgress % 1500 < 10 && game.biomeProgress > 100 && !game.bossChase) {
      game.bossChase = true;
      game.bossX = game.camera.x - 100;
    }
    
    if (game.bossChase) {
      game.bossX += 4.5;
      if (game.bossX > player.x) {
        player.health = 0;
      }
      
      if (game.bossX > game.camera.x + 1000) {
        game.bossChase = false;
        setScore(s => s + 10000);
      }
    }
    
    // Update distance and score
    setDistance(d => d + game.scrollSpeed * 0.1);
    setScore(s => s + 1);
    
    // Check death
    if (player.health <= 0) {
      if (upgrades.revival && player.revival !== true) {
        player.health = 1;
        player.revival = true;
        player.invulnerable = 120;
        createParticles(player.x + player.width / 2, player.y + player.height / 2, 30, '#fbbf24', 8);
      } else {
        setEssenceBank(bank => bank + player.essence);
        setHighScore(h => Math.max(h, score));
        setGameState('dead');
      }
    }
  }, [gameState, distance, score, handlePlayerInput, updatePhysics, generatePlatform, spawnEnemy, spawnCollectible, createParticles, upgrades]);

  const renderGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const game = gameRef.current;
    const player = game.player;
    const biomeIndex = Math.floor(game.biomeProgress / 1000) % BIOMES.length;
    const biome = BIOMES[biomeIndex];
    
    // Clear
    ctx.fillStyle = biome.color;
    ctx.fillRect(0, 0, 800, 600);
    
    // Background layers (parallax)
    const parallaxOffset = game.camera.x * 0.3;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = biome.accent + '20';
    for (let i = 0; i < 5; i++) {
      const x = (i * 300 - parallaxOffset) % 1200 - 300;
      ctx.fillRect(x, 100 + i * 50, 200, 400);
    }
    ctx.globalAlpha = 1;
    
    // Mist effect
    ctx.fillStyle = biome.color + '80';
    for (let i = 0; i < 3; i++) {
      const x = (i * 400 - game.camera.x * 0.5) % 1600 - 400;
      ctx.beginPath();
      ctx.ellipse(x, 300, 300, 100, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.save();
    ctx.translate(-game.camera.x, 0);
    
    // Platforms
    game.platforms.forEach(platform => {
      if (platform.type === 'spike') {
        ctx.fillStyle = '#ef4444';
        ctx.strokeStyle = '#991b1b';
      } else if (platform.type === 'crumbling') {
        const alpha = platform.health > 0 ? platform.health / 60 : 0;
        ctx.fillStyle = biome.accent + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.strokeStyle = biome.glow + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      } else {
        ctx.fillStyle = biome.accent + '60';
        ctx.strokeStyle = biome.glow;
      }
      
      ctx.lineWidth = 2;
      ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
      ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
      
      // Platform glow
      if (platform.type !== 'crumbling' || platform.health > 0) {
        ctx.shadowColor = biome.glow;
        ctx.shadowBlur = 10;
        ctx.strokeRect(platform.x, platform.y, platform.width, platform.height);
        ctx.shadowBlur = 0;
      }
    });
    
    // Collectibles
    game.collectibles.forEach(col => {
      ctx.save();
      ctx.translate(col.x, col.y);
      ctx.rotate(col.float);
      
      if (col.type === 'essence') {
        ctx.fillStyle = '#00ffaa';
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, col.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.fillRect(-col.size, -col.size, col.size * 2, col.size * 2);
      }
      
      ctx.shadowBlur = 0;
      ctx.restore();
    });
    
    // Enemies
    game.enemies.forEach(enemy => {
      ctx.fillStyle = enemy.type === 'wasp' ? '#eab308' : 
                      enemy.type === 'wisp' ? '#8b5cf6' :
                      enemy.type === 'crawler' ? '#10b981' : '#dc2626';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      
      if (enemy.type === 'wasp') {
        // Triangle shape
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y - enemy.size);
        ctx.lineTo(enemy.x - enemy.size, enemy.y + enemy.size);
        ctx.lineTo(enemy.x + enemy.size, enemy.y + enemy.size);
        ctx.closePath();
        ctx.fill();
      } else if (enemy.type === 'wisp') {
        // Circle with trail
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // Rectangle
        ctx.fillRect(enemy.x - enemy.size / 2, enemy.y - enemy.size / 2, enemy.size, enemy.size);
      }
      
      ctx.shadowBlur = 0;
      
      // Health bar
      if (enemy.hp < enemy.maxHp) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(enemy.x - 20, enemy.y - enemy.size - 10, 40 * (enemy.hp / enemy.maxHp), 3);
      }
    });
    
    // Boss chase
    if (game.bossChase) {
      ctx.fillStyle = '#dc2626';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 30;
      
      // Massive intimidating shape
      const bossSize = 80;
      ctx.fillRect(game.bossX, 200, bossSize, 200);
      ctx.beginPath();
      ctx.moveTo(game.bossX + bossSize, 250);
      ctx.lineTo(game.bossX + bossSize + 40, 300);
      ctx.lineTo(game.bossX + bossSize, 350);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    }
    
    // Particles
    game.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    
    // Player
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    
    // Invulnerability flash
    if (player.invulnerable > 0 && Math.floor(player.invulnerable / 5) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    
    // Player body
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = biome.glow;
    ctx.lineWidth = 2;
    
    // Body
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
    ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    // Cape trail
    ctx.fillStyle = biome.accent + '80';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-player.width / 2 - i * 5 - player.vx, -player.height / 2, 4, player.height);
    }
    
    // Antennae
    ctx.strokeStyle = biome.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -player.height / 2);
    ctx.lineTo(-8, -player.height / 2 - 10);
    ctx.moveTo(5, -player.height / 2);
    ctx.lineTo(8, -player.height / 2 - 10);
    ctx.stroke();
    
    // Attack effect
    if (player.attacking) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(player.width, 0, 25, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // Player glow
    ctx.shadowColor = biome.glow;
    ctx.shadowBlur = 15;
    ctx.strokeRect(-player.width / 2, -player.height / 2, player.width, player.height);
    
    ctx.restore();
    ctx.restore();
    
    // UI
    // Health
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('HEALTH', 20, 30);
    for (let i = 0; i < player.maxHealth; i++) {
      if (i < player.health) {
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = '#44111180';
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(20 + i * 35, 40, 30, 30);
    }
    ctx.shadowBlur = 0;
    
    // Essence
    ctx.fillStyle = '#00ffaa';
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`ESSENCE: ${player.essence}`, 20, 100);
    ctx.shadowBlur = 0;
    
    // Distance and Score
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(distance)}m`, 780, 30);
    ctx.fillText(`SCORE: ${score}`, 780, 55);
    
    // Combo
    if (player.combo > 1) {
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`x${player.combo} COMBO!`, 780, 85);
      ctx.shadowBlur = 0;
    }
    
    // Biome name
    ctx.fillStyle = biome.glow;
    ctx.shadowColor = biome.glow;
    ctx.shadowBlur = 20;
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText(biome.name, 400, 580);
    ctx.shadowBlur = 0;
    
    // Boss warning
    if (game.bossChase) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 30;
      ctx.font = 'bold 32px serif';
      ctx.fillText('⚠ SOVEREIGN\'S SHADOW ⚠', 400, 100);
      ctx.shadowBlur = 0;
    }
    
    // Dash charges
    ctx.textAlign = 'left';
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`DASH: ${player.dashCharges}`, 20, 130);
    
    ctx.textAlign = 'left';
  }, [score, distance]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const gameLoop = setInterval(() => {
      updateGame();
      renderGame();
    }, 16);
    
    return () => clearInterval(gameLoop);
  }, [gameState, updateGame, renderGame]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      gameRef.current.keys[e.key] = true;
      if (e.key === 'Escape' && gameState === 'playing') {
        setGameState('paused');
      }
    };
    
    const handleKeyUp = (e) => {
      gameRef.current.keys[e.key] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  const purchaseUpgrade = (upgradeKey, cost) => {
    if (essenceBank >= cost) {
      setEssenceBank(bank => bank - cost);
      setUpgrades(prev => {
        const newUpgrades = { ...prev };
        if (upgradeKey === 'revival') {
          newUpgrades.revival = true;
        } else {
          newUpgrades[upgradeKey]++;
        }
        return newUpgrades;
      });
    }
  };

  return (
    <div className="w-full h-screen bg-gray-900 flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border-4 border-purple-500 shadow-2xl shadow-purple-500/50"
      />
      
      {gameState === 'menu' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-6xl font-serif text-purple-300 mb-2 drop-shadow-[0_0_30px_rgba(168,85,247,0.8)]">
              VEIL OF THE FORGOTTEN
            </h1>
            <p className="text-xl text-gray-300 italic font-serif max-w-2xl">
              "In ruins, we remember. In shadow, we run. In silence, we endure."
            </p>
            
            <div className="mt-12 space-y-4">
              <button
                onClick={initGame}
                className="px-12 py-4 bg-purple-600 hover:bg-purple-500 text-white text-2xl font-bold rounded-lg shadow-lg shadow-purple-500/50 transition-all hover:scale-105"
              >
                BEGIN YOUR PILGRIMAGE
              </button>
              
              <button
                onClick={() => setGameState('upgrade')}
                className="block mx-auto px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-cyan-500/50 transition-all hover:scale-105"
              >
                SANCTUARY ({essenceBank} Essence)
              </button>
            </div>
            
            <div className="mt-12 text-gray-400 text-sm space-y-2">
              <p className="text-lg text-purple-300 font-bold mb-3">CONTROLS</p>
              <p>ARROW KEYS / WASD - Move & Jump</p>
              <p>SHIFT / X - Air Dash</p>
              <p>Z / CTRL - Attack</p>
              <p>ESC - Pause</p>
            </div>
            
            {highScore > 0 && (
              <p className="text-yellow-400 text-xl mt-8">
                Best Distance: {Math.floor(highScore / 10)}m
              </p>
            )}
          </div>
        </div>
      )}
      
      {gameState === 'paused' && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
          <h2 className="text-4xl font-serif text-purple-300 mb-8">PAUSED</h2>
          <div className="space-y-4">
            <button
              onClick={() => setGameState('playing')}
              className="block px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white text-xl font-bold rounded-lg shadow-lg transition-all"
            >
              RESUME
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="block px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white text-xl font-bold rounded-lg shadow-lg transition-all"
            >
              RETURN TO MENU
            </button>
          </div>
        </div>
      )}
      
      {gameState === 'dead' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
          <div className="text-center space-y-6">
            <h2 className="text-5xl font-serif text-red-400 mb-4 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]">
              THE VEIL FALLS
            </h2>
            
            <div className="space-y-3 text-xl text-gray-300">
              <p className="text-cyan-400 text-3xl">Distance: {Math.floor(distance)}m</p>
              <p className="text-purple-400 text-2xl">Score: {score}</p>
              <p className="text-green-400">Essence Gained: +{gameRef.current.player.essence}</p>
            </div>
            
            <div className="mt-8 space-y-4">
              <button
                onClick={initGame}
                className="block mx-auto px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-purple-500/50 transition-all hover:scale-105"
              >
                RUN AGAIN
              </button>
              
              <button
                onClick={() => setGameState('upgrade')}
                className="block mx-auto px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-cyan-500/50 transition-all hover:scale-105"
              >
                VISIT SANCTUARY
              </button>
              
              <button
                onClick={() => setGameState('menu')}
                className="block mx-auto px-10 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg shadow-lg transition-all"
              >
                RETURN TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
      
      {gameState === 'upgrade' && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center overflow-y-auto py-8">
          <div className="max-w-4xl w-full px-4">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-serif text-purple-300 mb-2 drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]">
                THE SANCTUARY
              </h2>
              <p className="text-cyan-400 text-2xl">
                Essence: {essenceBank}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-purple-900/30 border-2 border-purple-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-purple-300 mb-4 flex items-center gap-2">
                  <Heart className="w-6 h-6" /> VITALITY
                </h3>
                <p className="text-gray-300 mb-4">Maximum Health: {upgrades.maxHealth}</p>
                <button
                  onClick={() => purchaseUpgrade('maxHealth', 500)}
                  disabled={essenceBank < 500}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  +1 Health (500)
                </button>
              </div>
              
              <div className="bg-cyan-900/30 border-2 border-cyan-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-cyan-300 mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6" /> MOBILITY
                </h3>
                <p className="text-gray-300 mb-4">Jump Boost: +{upgrades.jumpBoost}</p>
                <button
                  onClick={() => purchaseUpgrade('jumpBoost', 400)}
                  disabled={essenceBank < 400}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  Upgrade (400)
                </button>
              </div>
              
              <div className="bg-blue-900/30 border-2 border-blue-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-blue-300 mb-4 flex items-center gap-2">
                  <Zap className="w-6 h-6" /> DASH MASTERY
                </h3>
                <p className="text-gray-300 mb-4">Dash Charges: {upgrades.dashCharges}</p>
                <button
                  onClick={() => purchaseUpgrade('dashCharges', 800)}
                  disabled={essenceBank < 800 || upgrades.dashCharges >= 3}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  +1 Charge (800)
                </button>
              </div>
              
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-green-300 mb-4 flex items-center gap-2">
                  <Droplet className="w-6 h-6" /> ESSENCE MAGNET
                </h3>
                <p className="text-gray-300 mb-4">Range: {upgrades.essenceMagnet}x</p>
                <button
                  onClick={() => purchaseUpgrade('essenceMagnet', 600)}
                  disabled={essenceBank < 600 || upgrades.essenceMagnet >= 3}
                  className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  Upgrade (600)
                </button>
              </div>
              
              <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-red-300 mb-4 flex items-center gap-2">
                  <Sword className="w-6 h-6" /> COMBAT PROWESS
                </h3>
                <p className="text-gray-300 mb-4">Damage: +{upgrades.damageBoost}</p>
                <button
                  onClick={() => purchaseUpgrade('damageBoost', 700)}
                  disabled={essenceBank < 700}
                  className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  Upgrade (700)
                </button>
              </div>
              
              <div className="bg-yellow-900/30 border-2 border-yellow-500 rounded-lg p-6">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center gap-2">
                  <Crown className="w-6 h-6" /> PHOENIX BLOOM
                </h3>
                <p className="text-gray-300 mb-4">
                  {upgrades.revival ? 'Revive Once Per Run ✓' : 'Revive Once Per Run'}
                </p>
                <button
                  onClick={() => purchaseUpgrade('revival', 2000)}
                  disabled={essenceBank < 2000 || upgrades.revival}
                  className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded shadow-lg transition-all"
                >
                  {upgrades.revival ? 'ACQUIRED' : 'Purchase (2000)'}
                </button>
              </div>
            </div>
            
            <div className="text-center space-y-4">
              <button
                onClick={initGame}
                className="px-10 py-4 bg-purple-600 hover:bg-purple-500 text-white text-xl font-bold rounded-lg shadow-lg shadow-purple-500/50 transition-all hover:scale-105"
              >
                EMBARK
              </button>
              
              <button
                onClick={() => setGameState('menu')}
                className="block mx-auto px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg shadow-lg transition-all"
              >
                RETURN TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VeilOfTheForgotten;