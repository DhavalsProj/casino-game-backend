import { Test, TestingModule } from '@nestjs/testing';
import { TranscationController } from './transcation.controller';

describe('TranscationController', () => {
  let controller: TranscationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranscationController],
    }).compile();

    controller = module.get<TranscationController>(TranscationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
