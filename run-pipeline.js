const fs = require('fs');
const yaml = require('js-yaml');
const { execSync } = require('child_process');

try {
  const file = fs.readFileSync('./pipeline.yaml', 'utf8');
  const parsed = yaml.load(file);

  for (const step of parsed.steps) {
    console.log(`\n➡️ Running step: ${step.name}`);
    execSync(step.command, { stdio: 'inherit' });
  }

  console.log('\n✅ All steps completed');
} catch (err) {
  console.error('❌ Pipeline failed:', err.message);
  process.exit(1);
}
