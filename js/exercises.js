// Pre-loaded exercise library.
// unit: 'reps' (default) or 'sec' for timed holds. bw: true = bodyweight (weight optional).
// sets/reps are the default prescription used by the planner.

export const GROUPS = [
  { id: 'legs',      label: 'Legs',      icon: '🦵' },
  { id: 'arms',      label: 'Arms',      icon: '💪' },
  { id: 'back',      label: 'Back',      icon: '🔙' },
  { id: 'core',      label: 'Core',      icon: '🎯' },
  { id: 'chest',     label: 'Chest',     icon: '🛡️' },
  { id: 'shoulders', label: 'Shoulders', icon: '⛰️' },
];

const ex = (group, name, sets, reps, extra = {}) => ({
  id: `${group}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
  group, name, sets, reps, ...extra,
});

export const EXERCISES = [
  // LEGS
  ex('legs', 'Barbell Back Squat', 4, 8),
  ex('legs', 'Goblet Squat', 3, 12),
  ex('legs', 'Romanian Deadlift', 3, 10),
  ex('legs', 'Leg Press', 4, 10),
  ex('legs', 'Walking Lunges', 3, 12),
  ex('legs', 'Bulgarian Split Squat', 3, 10),
  ex('legs', 'Leg Extension', 3, 12),
  ex('legs', 'Lying Leg Curl', 3, 12),
  ex('legs', 'Hip Thrust', 4, 10),
  ex('legs', 'Standing Calf Raise', 4, 15),
  ex('legs', 'Step-Ups', 3, 10),
  ex('legs', 'Hack Squat', 3, 10),

  // ARMS
  ex('arms', 'Barbell Curl', 3, 10),
  ex('arms', 'Dumbbell Hammer Curl', 3, 12),
  ex('arms', 'Incline Dumbbell Curl', 3, 10),
  ex('arms', 'Cable Curl', 3, 12),
  ex('arms', 'Preacher Curl', 3, 10),
  ex('arms', 'Tricep Rope Pushdown', 3, 12),
  ex('arms', 'Overhead Tricep Extension', 3, 12),
  ex('arms', 'Skull Crushers', 3, 10),
  ex('arms', 'Close-Grip Bench Press', 3, 8),
  ex('arms', 'Bench Dips', 3, 12, { bw: true }),
  ex('arms', 'Concentration Curl', 3, 10),

  // BACK
  ex('back', 'Deadlift', 4, 5),
  ex('back', 'Lat Pulldown', 4, 10),
  ex('back', 'Pull-Ups', 3, 8, { bw: true }),
  ex('back', 'Bent-Over Barbell Row', 4, 8),
  ex('back', 'Seated Cable Row', 3, 12),
  ex('back', 'Single-Arm Dumbbell Row', 3, 10),
  ex('back', 'T-Bar Row', 3, 10),
  ex('back', 'Face Pulls', 3, 15),
  ex('back', 'Straight-Arm Pulldown', 3, 12),
  ex('back', 'Back Extension', 3, 12, { bw: true }),
  ex('back', 'Assisted Pull-Up Machine', 3, 10),

  // CORE
  ex('core', 'Plank', 3, 45, { unit: 'sec', bw: true }),
  ex('core', 'Side Plank', 3, 30, { unit: 'sec', bw: true }),
  ex('core', 'Hanging Leg Raise', 3, 12, { bw: true }),
  ex('core', 'Cable Crunch', 3, 15),
  ex('core', 'Russian Twist', 3, 20),
  ex('core', 'Ab Wheel Rollout', 3, 10, { bw: true }),
  ex('core', 'Dead Bug', 3, 12, { bw: true }),
  ex('core', 'Bicycle Crunch', 3, 20, { bw: true }),
  ex('core', 'Pallof Press', 3, 12),
  ex('core', 'Mountain Climbers', 3, 30, { unit: 'sec', bw: true }),
  ex('core', 'Decline Sit-Up', 3, 15, { bw: true }),

  // CHEST
  ex('chest', 'Barbell Bench Press', 4, 8),
  ex('chest', 'Incline Dumbbell Press', 3, 10),
  ex('chest', 'Dumbbell Flyes', 3, 12),
  ex('chest', 'Cable Crossover', 3, 12),
  ex('chest', 'Chest Press Machine', 3, 10),
  ex('chest', 'Push-Ups', 3, 15, { bw: true }),
  ex('chest', 'Pec Deck', 3, 12),

  // SHOULDERS
  ex('shoulders', 'Overhead Press', 4, 8),
  ex('shoulders', 'Seated Dumbbell Press', 3, 10),
  ex('shoulders', 'Lateral Raise', 3, 15),
  ex('shoulders', 'Rear Delt Fly', 3, 15),
  ex('shoulders', 'Arnold Press', 3, 10),
  ex('shoulders', 'Front Raise', 3, 12),
  ex('shoulders', 'Upright Row', 3, 10),
];

export const PEOPLE = [
  { id: 'jazz', label: 'Jazz', color: '#ff2bd6' },
  { id: 'andy', label: 'Andy', color: '#2de2e6' },
];
