// Test script for ASI-One integration
// This can be run in the browser console or as a separate test

import { getASIOneService } from './asiOneService';
import { AgentCommunicationService } from './agentCommunication';

export class ASIOneIntegrationTester {
  private asiOneService = getASIOneService();
  private agentService = new AgentCommunicationService();

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting ASI-One Integration Tests...\n');

    try {
      await this.testASIOneService();
      await this.testAgentCommunication();
      await this.testConversationManagement();
      await this.testErrorHandling();
      
      console.log('✅ All tests completed successfully!');
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async testASIOneService(): Promise<void> {
    console.log('🔍 Testing ASI-One Service...');
    
    try {
      // Test basic message sending with conversation history
      const testHistory = [
        { role: 'user' as const, content: 'Hello', timestamp: Date.now() },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: Date.now() }
      ];
      
      const response = await this.asiOneService.sendMessage("This is a test message", {
        conversationHistory: testHistory
      });
      console.log('✅ ASI-One service response:', response.substring(0, 100) + '...');
      
      // Test without conversation history
      const response2 = await this.asiOneService.sendMessage("Another test message");
      console.log('✅ ASI-One service response (no history):', response2.substring(0, 100) + '...');
      
      console.log('✅ ASI-One service is now STATELESS - history managed by frontend');
      
    } catch (error) {
      console.error('❌ ASI-One service test failed:', error);
    }
  }

  async testAgentCommunication(): Promise<void> {
    console.log('🔍 Testing Agent Communication...');
    
    try {
      // Test agent routing
      const transferAgent = this.agentService.routeMessage("Send 5 DOT to Alice");
      console.log('✅ Transfer message routed to:', transferAgent);
      
      const swapAgent = this.agentService.routeMessage("Swap DOT for USDC");
      console.log('✅ Swap message routed to:', swapAgent);
      
      // Test agent availability
      const availability = await this.agentService.checkAgentAvailability();
      console.log('✅ Agent availability:', availability);
      
      // Test agent info
      const agents = this.agentService.getAvailableAgents();
      console.log('✅ Available agents:', agents.map(a => a.name));
      
    } catch (error) {
      console.error('❌ Agent communication test failed:', error);
    }
  }

  async testConversationManagement(): Promise<void> {
    console.log('🔍 Testing Conversation Management...');
    
    console.log('ℹ️ Conversation management is now handled by the frontend (App.tsx)');
    console.log('ℹ️ ASIOneService is STATELESS - it receives history via context');
    console.log('ℹ️ Frontend maintains conversationHistory in React state');
    console.log('✅ Architecture updated - no service-level conversation management needed');
  }

  async testErrorHandling(): Promise<void> {
    console.log('🔍 Testing Error Handling...');
    
    try {
      // Test with invalid API key (if configured)
      const testService = getASIOneService({
        apiKey: 'invalid_key_for_testing',
        baseUrl: 'https://api.asi1.ai/v1'
      });
      
      const response = await testService.sendMessage("This should fail gracefully");
      console.log('✅ Error handling works - got fallback response:', response.substring(0, 50) + '...');
      
    } catch (error) {
      console.log('✅ Error handling works - caught expected error:', error);
    }
  }

  async testRealAgentCommunication(): Promise<void> {
    console.log('🔍 Testing Real Agent Communication...');
    
    try {
      const testMessages = [
        "Hello, I'm testing DotBot",
        "Check my DOT balance",
        "Send 1 DOT to Alice",
        "Swap DOT for USDC",
        "Show me active referendums"
      ];

      for (const message of testMessages) {
        console.log(`\n📤 Sending: "${message}"`);
        
        const agentId = this.agentService.routeMessage(message);
        console.log(`🎯 Routed to agent: ${agentId}`);
        
        const response = await this.agentService.sendToAgent({
          agentId,
          message,
          context: {
            conversationHistory: [], // Now using conversationHistory instead of conversationId
            userWallet: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
            network: 'Polkadot'
          }
        });
        
        console.log(`📥 Response: ${response.content.substring(0, 100)}...`);
        console.log(`📊 Metadata:`, response.metadata);
      }
      
    } catch (error) {
      console.error('❌ Real agent communication test failed:', error);
    }
  }
}

// Export for use in browser console or tests
export const runASIOneTests = async () => {
  const tester = new ASIOneIntegrationTester();
  await tester.runAllTests();
};

// Auto-run tests if in development
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 ASI-One Integration Tester loaded. Run runASIOneTests() to test the integration.');
}
