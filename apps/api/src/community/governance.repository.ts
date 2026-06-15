import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  castPollVote,
  normalizeMeetingType,
  planPoll,
  tallyPoll,
  type PollStatus,
} from "../../../../packages/community-core/src/index.ts";

interface MeetingRecord {
  id: string;
  societyId: string;
  title: string;
  date: Date;
  meetingType: string;
  attendees: string | null;
  agenda: string;
  minutes: string;
  decisions: string | null;
  recordedBy: string;
  createdAt: Date;
}

interface PollRecord {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  options: string;
  votes: string;
  voters: string;
  createdBy: string;
  status: string;
  closesAt: Date | null;
  createdAt: Date;
}

export interface GovernancePersistenceClient {
  meetingMinutes: {
    create(input: { data: Record<string, unknown> }): Promise<MeetingRecord>;
    findMany(input: Record<string, unknown>): Promise<MeetingRecord[]>;
  };
  poll: {
    create(input: { data: Record<string, unknown> }): Promise<PollRecord>;
    findFirst(input: Record<string, unknown>): Promise<PollRecord | null>;
    findMany(input: Record<string, unknown>): Promise<PollRecord[]>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<PollRecord>;
  };
}

export interface RecordMeetingCommand {
  societyId: string;
  title: string;
  date: Date;
  meetingType?: string;
  agenda: string;
  minutes: string;
  attendees?: string[];
  decisions?: string;
  recordedBy: string;
}

export interface CreatePollCommand {
  societyId: string;
  title: string;
  description?: string;
  options: string[];
  createdBy: string;
  closesAt?: Date;
}

export interface CastVoteCommand {
  societyId: string;
  pollId: string;
  voterRef: string;
  optionIndex: number;
  now?: Date;
}

@Injectable()
export class GovernanceRepository {
  constructor(
    private readonly client: GovernancePersistenceClient = prisma as unknown as GovernancePersistenceClient,
  ) {}

  async recordMeeting(command: RecordMeetingCommand) {
    const meetingType = normalizeMeetingType(command.meetingType);

    const meeting = await this.client.meetingMinutes.create({
      data: {
        societyId: command.societyId,
        title: command.title,
        date: command.date,
        meetingType,
        agenda: command.agenda,
        minutes: command.minutes,
        attendees: command.attendees ? JSON.stringify(command.attendees) : null,
        decisions: command.decisions ?? null,
        recordedBy: command.recordedBy,
      },
    });

    return {
      recorded: true as const,
      meetingId: meeting.id,
      meetingType,
      attendeeCount: command.attendees?.length ?? 0,
    };
  }

  async listMeetings(societyId: string) {
    const meetings = await this.client.meetingMinutes.findMany({
      where: { societyId },
      orderBy: { date: "desc" },
    });

    return meetings.map((meeting) => ({
      ...meeting,
      attendees: parseStringArray(meeting.attendees),
    }));
  }

  async createPoll(command: CreatePollCommand) {
    const plan = planPoll({
      title: command.title,
      description: command.description,
      options: command.options,
    });

    const poll = await this.client.poll.create({
      data: {
        societyId: command.societyId,
        title: plan.title,
        description: plan.description ?? null,
        options: JSON.stringify(plan.options),
        votes: "{}",
        voters: "[]",
        createdBy: command.createdBy,
        status: "active",
        closesAt: command.closesAt ?? null,
      },
    });

    return { created: true as const, pollId: poll.id, options: plan.options };
  }

  async castVote(command: CastVoteCommand) {
    const poll = await this.requirePoll(command.societyId, command.pollId);
    const result = castPollVote({
      state: {
        options: parseStringArray(poll.options),
        votes: parseVotes(poll.votes),
        voters: parseStringArray(poll.voters),
        status: poll.status as PollStatus,
        closesAt: poll.closesAt,
      },
      voterRef: command.voterRef,
      optionIndex: command.optionIndex,
      now: command.now ?? new Date(),
    });

    await this.client.poll.update({
      where: { id: poll.id },
      data: { votes: JSON.stringify(result.votes), voters: JSON.stringify(result.voters) },
    });

    return { voted: true as const, pollId: poll.id, optionIndex: command.optionIndex };
  }

  async closePoll(societyId: string, pollId: string) {
    const poll = await this.requirePoll(societyId, pollId);
    const updated = await this.client.poll.update({
      where: { id: poll.id },
      data: { status: "closed" },
    });

    return { closed: true as const, pollId: updated.id };
  }

  async getPollResults(societyId: string, pollId: string) {
    const poll = await this.requirePoll(societyId, pollId);
    const tally = tallyPoll({
      options: parseStringArray(poll.options),
      votes: parseVotes(poll.votes),
    });

    return {
      pollId: poll.id,
      title: poll.title,
      status: poll.status,
      ...tally,
    };
  }

  async listPolls(societyId: string, status?: string) {
    const polls = await this.client.poll.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      closesAt: poll.closesAt,
      ...tallyPoll({ options: parseStringArray(poll.options), votes: parseVotes(poll.votes) }),
    }));
  }

  private async requirePoll(societyId: string, pollId: string): Promise<PollRecord> {
    const poll = await this.client.poll.findFirst({ where: { id: pollId, societyId } });

    if (!poll) {
      throw new NotFoundException({ error: "not_found", reason: "Poll not found" });
    }

    return poll;
  }
}

function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function parseVotes(value: string | null): Record<string, number> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, number>;
    }
    return {};
  } catch {
    return {};
  }
}
