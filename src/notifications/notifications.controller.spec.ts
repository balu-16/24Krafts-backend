import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  const mockService = {
    saveToken: jest.fn(async (userId: string, dto: any) => ({ id: 'uuid', user_id: userId, token: dto.token })),
    revokeToken: jest.fn(),
    listDevices: jest.fn(),
    send: jest.fn(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should save token for current user', async () => {
    const user = { id: 'user-123' } as any;
    const dto = { token: 'ExpoPushToken[token]', platform: 'ios' } as any;
    const res = await controller.saveToken(user, dto);
    expect(res.user_id).toBe('user-123');
    expect(res.token).toBe('ExpoPushToken[token]');
  });
});