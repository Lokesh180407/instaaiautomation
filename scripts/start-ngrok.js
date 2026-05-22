// start-ngrok.js – Launch ngrok tunnel and configure app for OAuth
// Usage: npm run tunnel
// Creates .env.local with NGROK_URL for config.js to read

const ngrok = require('ngrok');
const fs = require('fs');
const path = require('path');

const LOCAL_PORT = process.env.PORT || 8000;

async function startTunnel() {
  try {
    const authToken = process.env.NGROK_AUTHTOKEN || '';
    const url = await ngrok.connect({ addr: LOCAL_PORT, authtoken: authToken });
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                   ✅ ngrok Tunnel Started                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🔗 PUBLIC NGROK URL:', url);
    console.log('');
    console.log('📋 IMPORTANT: Add this to Supabase OAuth redirect URLs:');
    console.log(`   ${url}/oauth-callback.html`);
    console.log('');

    const envPath = path.resolve(__dirname, '..', '.env.local');
    const data = `NGROK_URL=${url}\nNGROK_TIMESTAMP=${new Date().toISOString()}\n`;
    fs.writeFileSync(envPath, data, { encoding: 'utf8' });
    console.log('📁 Config saved to .env.local');
    console.log('');
    console.log('🌐 Access your app at:');
    console.log(`   ${url}/auth.html (Login)`);
    console.log(`   ${url}/dashboard.html (Dashboard)`);
    console.log('');
    console.log('🛡️ Keeping tunnel alive – Press Ctrl+C to stop');
    console.log('');

    await new Promise(() => {});
  } catch (err) {
    console.error('❌ Failed to start ngrok tunnel:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down ngrok...');
  try {
    await ngrok.disconnect();
    await ngrok.kill();
    console.log('✅ ngrok tunnel closed');
  } catch (e) {
    console.error('Error during shutdown:', e);
  }
  process.exit(0);
});

startTunnel();
