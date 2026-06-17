import { Mission } from './types';

export interface MissionTemplate {
  templateId: string;
  type: 'running' | 'feeds' | 'evolution' | 'obstacles' | 'crystal_eggs' | 'stage_missions';
  text: string;
  target: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'SPECIAL';
  rewardType: 'feeds' | 'gems' | 'xp';
  rewardValue: number;
}

const MISSION_POOL: MissionTemplate[] = [
  // --- RUNNING ---
  {
    templateId: 'run_500',
    type: 'running',
    text: 'Run 500 meters in a single run',
    target: 500,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 120
  },
  {
    templateId: 'run_1000',
    type: 'running',
    text: 'Run 1,000 meters in a single run',
    target: 1000,
    difficulty: 'EASY',
    rewardType: 'xp',
    rewardValue: 200
  },
  {
    templateId: 'run_1500',
    type: 'running',
    text: 'Run 1,500 meters in a single run',
    target: 1500,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 300
  },
  {
    templateId: 'run_2000',
    type: 'running',
    text: 'Run 2,000 meters in a single run',
    target: 2000,
    difficulty: 'MEDIUM',
    rewardType: 'gems',
    rewardValue: 8
  },
  {
    templateId: 'run_3000',
    type: 'running',
    text: 'Run 3,000 meters in a single run',
    target: 3000,
    difficulty: 'MEDIUM',
    rewardType: 'gems',
    rewardValue: 12
  },
  {
    templateId: 'run_5000',
    type: 'running',
    text: 'Run 5,000 meters in a single run',
    target: 5000,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 25
  },

  // --- FEEDS ---
  {
    templateId: 'feeds_25',
    type: 'feeds',
    text: 'Collect 25 Feed Bags in total',
    target: 25,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 80
  },
  {
    templateId: 'feeds_50',
    type: 'feeds',
    text: 'Collect 50 Feed Bags in total',
    target: 50,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 150
  },
  {
    templateId: 'feeds_100',
    type: 'feeds',
    text: 'Collect 100 Feed Bags in total',
    target: 100,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 250
  },
  {
    templateId: 'feeds_150',
    type: 'feeds',
    text: 'Collect 150 Feed Bags cumulative',
    target: 150,
    difficulty: 'MEDIUM',
    rewardType: 'feeds',
    rewardValue: 300
  },
  {
    templateId: 'feeds_250',
    type: 'feeds',
    text: 'Collect 250 Feed Bags in total',
    target: 250,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 15
  },

  // --- EVOLUTION ---
  {
    templateId: 'evolve_egg',
    type: 'evolution',
    text: 'Evolve Egg to Chick (hatch 1 Egg)',
    target: 1,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 100
  },
  {
    templateId: 'evolve_chick',
    type: 'evolution',
    text: 'Evolve Chick to Hen',
    target: 1,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 300
  },
  {
    templateId: 'complete_2_evos',
    type: 'evolution',
    text: 'Complete 2 full development stages (Egg to Chick & Chick to Hen)',
    target: 2,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 20
  },

  // --- OBSTACLES ---
  {
    templateId: 'avoid_20',
    type: 'obstacles',
    text: 'Evade 20 farm obstacles and traffic vehicles safely',
    target: 20,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 100
  },
  {
    templateId: 'avoid_50',
    type: 'obstacles',
    text: 'Evade 50 farm obstacles and traffic vehicles safely',
    target: 50,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 250
  },
  {
    templateId: 'avoid_100',
    type: 'obstacles',
    text: 'Avoid 100 hazardous obstacles cumulative',
    target: 100,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 18
  },

  // --- CRYSTAL EGGS ---
  {
    templateId: 'crystal_1',
    type: 'crystal_eggs',
    text: 'Collect 1 rare Crystal Egg during a run',
    target: 1,
    difficulty: 'EASY',
    rewardType: 'gems',
    rewardValue: 4
  },
  {
    templateId: 'crystal_5',
    type: 'crystal_eggs',
    text: 'Collect 5 rare Crystal Eggs',
    target: 5,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 300
  },
  {
    templateId: 'crystal_10',
    type: 'crystal_eggs',
    text: 'Collect 10 rare Crystal Eggs across runs',
    target: 10,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 20
  },

  // --- STAGE MISSIONS ---
  {
    templateId: 'reach_stage2',
    type: 'stage_missions',
    text: 'Transition to Stage 2 by laying 50 eggs',
    target: 1,
    difficulty: 'MEDIUM',
    rewardType: 'gems',
    rewardValue: 10
  },
  {
    templateId: 'lay_10_eggs',
    type: 'stage_missions',
    text: 'Lay 10 dynamic eggs behind your hen',
    target: 10,
    difficulty: 'EASY',
    rewardType: 'feeds',
    rewardValue: 150
  },
  {
    templateId: 'complete_1_tray',
    type: 'stage_missions',
    text: 'Complete 1 Tray of Eggs (lay 20 eggs)',
    target: 20,
    difficulty: 'MEDIUM',
    rewardType: 'xp',
    rewardValue: 300
  },
  {
    templateId: 'complete_1_batch',
    type: 'stage_missions',
    text: 'Complete 1 Batch of Eggs (lay 40 eggs in runs)',
    target: 40,
    difficulty: 'HARD',
    rewardType: 'gems',
    rewardValue: 22
  },

  // --- SPECIAL / SPECIAL CHALLENGE POOL ---
  {
    templateId: 'special_run_5000',
    type: 'running',
    text: 'Special Challenge: Run 5,000 meters in a single run',
    target: 5000,
    difficulty: 'SPECIAL',
    rewardType: 'gems',
    rewardValue: 30
  },
  {
    templateId: 'special_feeds_300',
    type: 'feeds',
    text: 'Special Challenge: Code-Red Harvest! Collect 300 Feed Bags',
    target: 300,
    difficulty: 'SPECIAL',
    rewardType: 'gems',
    rewardValue: 30
  },
  {
    templateId: 'special_stage2_twice',
    type: 'stage_missions',
    text: 'Special Challenge: Reach Stage 2 twice today',
    target: 2,
    difficulty: 'SPECIAL',
    rewardType: 'gems',
    rewardValue: 40
  },
  {
    templateId: 'special_avoid_150',
    type: 'obstacles',
    text: 'Special Challenge: Master Evader! Evade 150 obstacles successfully',
    target: 150,
    difficulty: 'SPECIAL',
    rewardType: 'gems',
    rewardValue: 35
  },
  {
    templateId: 'special_crystal_15',
    type: 'crystal_eggs',
    text: 'Special Challenge: Collect 15 rare Crystal Eggs today',
    target: 15,
    difficulty: 'SPECIAL',
    rewardType: 'gems',
    rewardValue: 35
  }
];

export function generateDailyMissions(): Mission[] {
  // Load mission history from localStorage to avoid consecutive / last 3 days repetition
  let history: string[] = [];
  try {
    const rawHistory = localStorage.getItem('skm_missions_history_ids');
    if (rawHistory) {
      history = JSON.parse(rawHistory);
    }
  } catch (e) {
    history = [];
  }

  // Filter pool based on history (prefer those not shown recently)
  // We keep a rolling history of the last 18 chosen templateIds
  const unusedInHistory = MISSION_POOL.filter(m => !history.includes(m.templateId));

  const filterPool = (difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'SPECIAL'): MissionTemplate[] => {
    // Try unused templates of that difficulty first
    let candidates = unusedInHistory.filter(m => m.difficulty === difficulty);
    if (candidates.length === 0) {
      // Fallback to full pool of that difficulty
      candidates = MISSION_POOL.filter(m => m.difficulty === difficulty);
    }
    return candidates;
  };

  const selectedTemplates: MissionTemplate[] = [];

  // Pick 3 Easy
  const easyPool = [...filterPool('EASY')];
  for (let i = 0; i < 3; i++) {
    if (easyPool.length > 0) {
      const idx = Math.floor(Math.random() * easyPool.length);
      selectedTemplates.push(easyPool[idx]);
      easyPool.splice(idx, 1);
    }
  }

  // Pick 2 Medium
  const mediumPool = [...filterPool('MEDIUM')];
  for (let i = 0; i < 2; i++) {
    if (mediumPool.length > 0) {
      const idx = Math.floor(Math.random() * mediumPool.length);
      selectedTemplates.push(mediumPool[idx]);
      mediumPool.splice(idx, 1);
    }
  }

  // Pick 1 Hard
  const hardPool = [...filterPool('HARD')];
  if (hardPool.length > 0) {
    const idx = Math.floor(Math.random() * hardPool.length);
    selectedTemplates.push(hardPool[idx]);
  }

  // Pick 1 Special Daily Challenge
  const specialPool = [...filterPool('SPECIAL')];
  if (specialPool.length > 0) {
    const idx = Math.floor(Math.random() * specialPool.length);
    selectedTemplates.push(specialPool[idx]);
  }

  // Format into active Mission states
  const dailyMissions: Mission[] = selectedTemplates.map((t, idx) => {
    return {
      id: `m_${Date.now()}_${idx}_${t.difficulty.toLowerCase()}`,
      text: t.text,
      progress: 0,
      target: t.target,
      completed: false,
      claimed: false,
      rewardType: t.rewardType,
      rewardValue: t.rewardValue,
      type: t.type,
      difficulty: t.difficulty
    } as any; // Cast so that extended fields from typescript or templates pass fine
  });

  // Update history in localStorage
  const nextHistory = [...history];
  dailyMissions.forEach(m => {
    const matchingTemplate = MISSION_POOL.find(p => p.text === m.text);
    if (matchingTemplate) {
      nextHistory.push(matchingTemplate.templateId);
    }
  });

  // Cap rolling history to last 18 items (3 days of daily missions)
  if (nextHistory.length > 18) {
    nextHistory.splice(0, nextHistory.length - 18);
  }
  localStorage.setItem('skm_missions_history_ids', JSON.stringify(nextHistory));

  return dailyMissions;
}
