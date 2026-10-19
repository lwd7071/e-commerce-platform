import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '@/lib/api/chat.api';
import { apiChatRepository, mockChatRepository } from '@/lib/repositories/repository-factory';

describe('apiChatRepository', () => {
  afterEach(() => vi.restoreAllMocks());

  it('propagates chat API failures instead of returning unrelated mock history', async () => {
    const error = new Error('Chat API unavailable');
    const getConversations = vi.spyOn(chatApi, 'getConversations').mockRejectedValue(error);
    const getMessages = vi.spyOn(chatApi, 'getMessages').mockRejectedValue(error);
    const sendMessage = vi.spyOn(chatApi, 'sendMessage').mockRejectedValue(error);
    const mockGetConversations = vi.spyOn(mockChatRepository, 'getConversations');
    const mockGetMessages = vi.spyOn(mockChatRepository, 'getMessages');
    const mockSendMessage = vi.spyOn(mockChatRepository, 'sendMessage');

    await expect(apiChatRepository.getConversations()).rejects.toBe(error);
    await expect(apiChatRepository.getMessages('conv-001')).rejects.toBe(error);
    await expect(apiChatRepository.sendMessage('conv-001', { content: 'Xin chào' })).rejects.toBe(error);

    expect(getConversations).toHaveBeenCalledOnce();
    expect(getMessages).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(mockGetConversations).not.toHaveBeenCalled();
    expect(mockGetMessages).not.toHaveBeenCalled();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
