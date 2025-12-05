import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { YouTubeService } from '../youtube/youtube.service';
import { BadRequestException } from '@nestjs/common';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: PrismaService;
  let feedService: FeedService;

  const mockPrismaService = {
    subscription: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockFeedService = {
    getOrCreateFeed: jest.fn(),
  };

  const mockYouTubeService = {
    resolveChannel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FeedService, useValue: mockFeedService },
        { provide: YouTubeService, useValue: mockYouTubeService },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    prisma = module.get<PrismaService>(PrismaService);
    feedService = module.get<FeedService>(FeedService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSiteSubscription', () => {
    const userId = 'user-123';
    const dto = { url: 'https://example.com' };

    it('should create a new site subscription', async () => {
      const mockFeed = { id: 'feed-123', url: dto.url };
      const mockSubscription = {
        id: 'sub-123',
        userId,
        type: 'site',
        target: dto.url,
        feedId: mockFeed.id,
        feed: mockFeed,
      };

      mockPrismaService.subscription.findFirst.mockResolvedValue(null);
      mockFeedService.getOrCreateFeed.mockResolvedValue(mockFeed);
      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

      const result = await service.createSiteSubscription(userId, dto);

      expect(result).toEqual(mockSubscription);
      expect(mockFeedService.getOrCreateFeed).toHaveBeenCalledWith(dto.url);
      expect(mockPrismaService.subscription.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid URL', async () => {
      await expect(
        service.createSiteSubscription(userId, { url: 'not-a-url' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate subscription', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValue({
        id: 'existing-sub',
      });

      await expect(
        service.createSiteSubscription(userId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const userId = 'user-123';
      const mockSubscriptions = [
        { id: 'sub-1', type: 'site' },
        { id: 'sub-2', type: 'youtube' },
      ];

      mockPrismaService.subscription.findMany.mockResolvedValue(mockSubscriptions);
      mockPrismaService.subscription.count.mockResolvedValue(2);

      const result = await service.getUserSubscriptions(userId, 1, 20);

      expect(result.data).toEqual(mockSubscriptions);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
    });
  });
});



