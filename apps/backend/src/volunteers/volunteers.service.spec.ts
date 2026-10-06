import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VolunteersService } from './volunteers.service';
import { FosterVolunteer } from './volunteers.entity';
import { VolunteerStatus } from './volunteers.types';
import { EmailsService } from '../aws/ses/email.service';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let repo: { findOneBy: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let emailsService: { sendEmail: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    emailsService = { sendEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        {
          provide: getRepositoryToken(FosterVolunteer),
          useValue: repo,
        },
        { provide: EmailsService, useValue: emailsService },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIdOrFail', () => {
    it('returns the volunteer when one with the id exists', async () => {
      const volunteer = { volunteerId: 7 } as FosterVolunteer;
      repo.findOneBy.mockResolvedValue(volunteer);

      const result = await service.findByIdOrFail(7);

      expect(result).toBe(volunteer);
      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });

    it('throws NotFoundException when no volunteer with the id exists', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.findByIdOrFail(7)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 7 not found'),
      );
      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 7 });
    });
  });

  describe('deactivate', () => {
    it('sets status to Inactive, saves, and does not delete the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.ACTIVE,
      } as FosterVolunteer;
      repo.findOneBy.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });

      const result = await service.deactivate(1);

      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 1 });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.INACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.INACTIVE);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.deactivate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('sets status to Active and saves the volunteer', async () => {
      const volunteer = {
        volunteerId: 1,
        status: VolunteerStatus.INACTIVE,
      } as FosterVolunteer;
      repo.findOneBy.mockResolvedValue(volunteer);
      repo.save.mockResolvedValue({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });

      const result = await service.activate(1);

      expect(repo.findOneBy).toHaveBeenCalledWith({ volunteerId: 1 });
      expect(repo.save).toHaveBeenCalledWith({
        ...volunteer,
        status: VolunteerStatus.ACTIVE,
      });
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.activate(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    const pendingVolunteer = () =>
      ({
        volunteerId: 1,
        firstName: 'Jane',
        email: 'jane@example.com',
        status: VolunteerStatus.PENDING,
      } as FosterVolunteer);

    it('sets status to Active, saves, and emails the volunteer', async () => {
      repo.findOneBy.mockResolvedValue(pendingVolunteer());
      repo.save.mockImplementation(async (v) => v);

      const result = await service.approve(1);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VolunteerStatus.ACTIVE }),
      );
      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(emailsService.sendEmail).toHaveBeenCalledTimes(1);
      expect(emailsService.sendEmail).toHaveBeenCalledWith({
        toEmail: 'jane@example.com',
        subject: expect.any(String),
        bodyHtml: expect.stringContaining('Jane'),
      });
    });

    it('throws ConflictException and does not resend the email if already active', async () => {
      repo.findOneBy.mockResolvedValue({
        ...pendingVolunteer(),
        status: VolunteerStatus.ACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if the volunteer is inactive', async () => {
      repo.findOneBy.mockResolvedValue({
        ...pendingVolunteer(),
        status: VolunteerStatus.INACTIVE,
      });

      await expect(service.approve(1)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if volunteer does not exist', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.approve(999)).rejects.toThrow(
        new NotFoundException('Volunteer with ID 999 not found'),
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(emailsService.sendEmail).not.toHaveBeenCalled();
    });

    it('still approves the volunteer if the email fails to send', async () => {
      repo.findOneBy.mockResolvedValue(pendingVolunteer());
      repo.save.mockImplementation(async (v) => v);
      emailsService.sendEmail.mockRejectedValue(new Error('SES down'));
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      const result = await service.approve(1);

      expect(result.status).toBe(VolunteerStatus.ACTIVE);
      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
