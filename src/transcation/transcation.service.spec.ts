import { Test, TestingModule } from '@nestjs/testing';
import { TranscationService } from './transcation.service';

describe('TranscationService', () => {
  let service: TranscationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranscationService],
    }).compile();

    service = module.get<TranscationService>(TranscationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
