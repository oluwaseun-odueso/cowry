import { AccountRepository } from '../models/account';
import { CardRepository, Card, CardWithPan } from '../models/card';

export class CardService {
  private async getCardForUser(userId: string, cardId: string): Promise<Card> {
    const card = await CardRepository.findById(cardId);
    if (!card) throw new Error('Card not found.');
    // Verify ownership via account
    const account = await AccountRepository.findById(card.accountId);
    if (!account || account.userId !== userId) throw new Error('Card not found.');
    return card;
  }

  async issueCard(userId: string, accountId: string): Promise<Card> {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw new Error('Account not found.');
    if (account.userId !== userId) throw new Error('Account not found.');

    // Check if a non-disposable card already exists for this account
    const existing = await CardRepository.findByAccountId(accountId);
    const hasPermanent = existing.some(c => !c.isDisposable && c.status !== 'cancelled');
    if (hasPermanent) throw new Error('A card already exists for this account.');

    return CardRepository.create(accountId, 'debit');
  }

  async issueDisposableCard(userId: string, accountId: string): Promise<Card> {
    const account = await AccountRepository.findById(accountId);
    if (!account) throw new Error('Account not found.');
    if (account.userId !== userId) throw new Error('Account not found.');
    return CardRepository.create(accountId, 'disposable');
  }

  async listCards(userId: string, accountId: string): Promise<Card[]> {
    const account = await AccountRepository.findById(accountId);
    if (!account || account.userId !== userId) throw new Error('Account not found.');
    return CardRepository.findByAccountId(accountId);
  }

  async getCard(userId: string, cardId: string): Promise<Card> {
    return this.getCardForUser(userId, cardId);
  }

  async revealCard(userId: string, cardId: string): Promise<CardWithPan> {
    const card = await this.getCardForUser(userId, cardId);
    if (card.status === 'cancelled') throw new Error('Card is cancelled.');
    const revealed = await CardRepository.reveal(cardId);
    if (!revealed) throw new Error('Card not found.');
    return revealed;
  }

  async freezeCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.getCardForUser(userId, cardId);
    if (card.status !== 'active') throw new Error(`Card cannot be frozen (status: ${card.status}).`);
    await CardRepository.updateStatus(cardId, 'frozen', true);
    return (await CardRepository.findById(cardId))!;
  }

  async unfreezeCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.getCardForUser(userId, cardId);
    if (card.status !== 'frozen') throw new Error('Card is not frozen.');
    await CardRepository.updateStatus(cardId, 'active', false);
    return (await CardRepository.findById(cardId))!;
  }

  async blockCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.getCardForUser(userId, cardId);
    if (['cancelled', 'used'].includes(card.status)) throw new Error(`Card cannot be blocked (status: ${card.status}).`);
    await CardRepository.updateStatus(cardId, 'blocked', false);
    return (await CardRepository.findById(cardId))!;
  }

  async unblockCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.getCardForUser(userId, cardId);
    if (card.status !== 'blocked') throw new Error('Card is not blocked.');
    await CardRepository.updateStatus(cardId, 'active', false);
    return (await CardRepository.findById(cardId))!;
  }

  async cancelCard(userId: string, cardId: string): Promise<Card> {
    const card = await this.getCardForUser(userId, cardId);
    if (card.status === 'cancelled') throw new Error('Card is already cancelled.');
    await CardRepository.updateStatus(cardId, 'cancelled', false);
    return (await CardRepository.findById(cardId))!;
  }
}
