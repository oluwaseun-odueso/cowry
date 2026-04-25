import { Request, Response } from 'express';
import { CardService } from '../services/card.service';
import { MerchantBlockRepository } from '../models/merchantBlock';

export class CardController {
  private cardService = new CardService();

  issueCard = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.issueCard(req.user!.id, req.params.id);
      return res.status(201).json({ status: 'success', data: { card } });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : err.message.includes('already exists') ? 409 : 400;
      return res.status(status).json({ status: 'error', message: err.message });
    }
  };

  issueDisposableCard = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.issueDisposableCard(req.user!.id, req.params.id);
      return res.status(201).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  listCards = async (req: Request<{ id: string }>, res: Response): Promise<Response> => {
    try {
      const cards = await this.cardService.listCards(req.user!.id, req.params.id);
      return res.status(200).json({ status: 'success', data: { cards } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  getCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.getCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(404).json({ status: 'error', message: err.message });
    }
  };

  revealCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.revealCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  freezeCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.freezeCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  unfreezeCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.unfreezeCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  blockCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.blockCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  unblockCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.unblockCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  cancelCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.cancelCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  cancelDisposableCard = async (req: Request<{ cardId: string }>, res: Response): Promise<Response> => {
    try {
      const card = await this.cardService.cancelDisposableCard(req.user!.id, req.params.cardId);
      return res.status(200).json({ status: 'success', data: { card } });
    } catch (err: any) {
      return res.status(400).json({ status: 'error', message: err.message });
    }
  };

  // ─── Merchant blocks ─────────────────────────────────────────────────────────

  listMerchantBlocks = async (req: Request, res: Response): Promise<Response> => {
    try {
      const blocks = await MerchantBlockRepository.findByUserId(req.user!.id);
      return res.status(200).json({ status: 'success', data: { blocks } });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };

  createMerchantBlock = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { merchantName } = req.body;
      if (!merchantName?.trim()) {
        return res.status(400).json({ status: 'error', message: 'merchantName is required.' });
      }
      const block = await MerchantBlockRepository.create(req.user!.id, merchantName.trim());
      return res.status(201).json({ status: 'success', data: { block } });
    } catch (err: any) {
      const status = err.message.includes('Duplicate') ? 409 : 400;
      return res.status(status).json({ status: 'error', message: err.message });
    }
  };

  deleteMerchantBlock = async (req: Request<{ blockId: string }>, res: Response): Promise<Response> => {
    try {
      const deleted = await MerchantBlockRepository.delete(req.params.blockId, req.user!.id);
      if (!deleted) return res.status(404).json({ status: 'error', message: 'Block not found.' });
      return res.status(200).json({ status: 'success', message: 'Block removed.' });
    } catch (err: any) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  };
}
