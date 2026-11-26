import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { asc, eq, inArray, and } from 'drizzle-orm';
import { db } from '../../db';
import { churches, regions, pastoralAssignments, pastors, churchBranches } from '../../db/schema';
import { memoryStore } from '../memory-store';
import { requireAdmin } from '../middleware/auth';
import { matchesPrefix } from '../../lib/utils';

const createChurchSchema = z.object({
  name: z.string().min(2).max(120),
  form: z.enum(['Chi hội', 'Điểm nhóm', 'Hội nhánh']),
  legalType: z.enum(['Chính thức', 'Nội bộ']).default('Chính thức'),
  autonomy: z.enum(['Tự lập', 'Tự dưỡng']).nullable().optional(),
  regionCode: z.enum(['I', 'II', 'III', 'IV', 'V', 'VI']),
  parentChurchName: z.string().max(120).nullable().optional(),
  newAddress: z.string().min(3).max(220),
  newWard: z.string().min(2).max(80),
  oldAddress: z.string().max(220).nullable().optional(),
  pastorName: z.string().max(100).nullable().optional(),
  pastorRole: z.enum(['Quản nhiệm', 'Kiêm nhiệm', 'Đặc trách']).default('Quản nhiệm'),
  pastorPhone: z.string().max(20).nullable().optional(),
  memberCount: z.coerce.number().int().min(0).max(50000).default(50),
  regularAttendanceCount: z.coerce.number().int().min(0).max(50000).default(0),
  foundedYear: z.coerce.number().int().min(1900).max(2030).nullable().optional(),
});

const updateChurchSchema = z.object({
  memberCount: z.coerce.number().int().min(0).max(50000).optional(),
  regularAttendanceCount: z.coerce.number().int().min(0).max(50000).optional(),
  legalType: z.enum(['Chính thức', 'Nội bộ']).optional(),
  autonomy: z.enum(['Tự lập', 'Tự dưỡng']).nullable().optional(),
  newAddress: z.string().min(3).max(220).optional(),
  oldAddress: z.string().max(220).nullable().optional(),
  newWard: z.string().max(80).optional(),
  foundedYear: z.coerce.number().int().min(1900).max(2030).nullable().optional(),
  name: z.string().min(2).max(120).optional(),
  shortName: z.string().min(2).max(120).optional(),
  note: z.string().max(500).nullable().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const assignmentSchema = z.object({
  pastorId: z.coerce.number().int().positive(),
  role: z.enum(['Quản nhiệm', 'Kiêm nhiệm', 'Đặc trách', 'Phụ tá']).default('Quản nhiệm'),
  isPrimary: z.boolean().default(true),
  assignmentType: z.enum(['church', 'organization', 'other']).default('church'),
  workName: z.string().max(200).nullable().optional(),
});

const updateAssignmentSchema = z.object({
  role: z.enum(['Quản nhiệm', 'Kiêm nhiệm', 'Đặc trách', 'Phụ tá']).optional(),
  isPrimary: z.boolean().optional(),
});

export const churchesRoute = new Hono()
  .get('/:id', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param');

    if (!db) {
      const item = memoryStore.churches.find((x) => x.id === id);
      if (!item) return c.json({ error: 'Congregation not found' }, 404);
      return c.json({ church: item });
    }

    const [church] = await db
      .select()
      .from(churches)
      .where(eq(churches.id, id));

    if (!church) return c.json({ error: 'Congregation not found' }, 404);

    const [reg] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, church.regionId));

    const [assign] = await db
      .select()
      .from(pastoralAssignments)
      .where(eq(pastoralAssignments.churchId, id));

    const pastor = assign
      ? (
          await db
            .select()
            .from(pastors)
            .where(eq(pastors.id, assign.pastorId))
        )[0]
      : null;

    return c.json({
      church: {
        id: church.id,
        stt: church.stt,
        code: church.code,
        form: church.form,
        legalType: church.legalType,
        autonomy: church.autonomy,
        name: church.name,
        shortName: church.shortName,
        parentChurchId: church.parentChurchId,
        parentChurchName: church.parentChurchName,
        regionCode: reg?.code ?? 'I',
        regionName: reg?.name ?? 'Khu vực I',
        foundedYear: church.foundedYear,
        oldWard: church.oldWard,
        oldAddress: church.oldAddress,
        newAddress: church.newAddress,
        newWard: church.newWard,
        isInHcm: church.isInHcm,
        memberCount: church.memberCount,
        regularAttendanceCount: church.regularAttendanceCount,
        note: church.note,
        pastorName: pastor?.fullName ?? null,
        pastorTitle: pastor?.title ?? null,
        pastorRole: assign?.role ?? null,
        pastorPhone: pastor?.phone ? pastor.phone.replace(/\s+/g, '').trim() : null,
      },
    });
  })
  .get('/:id/pastors', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param');

    if (!db) return c.json({ error: 'Database not available' }, 500);

    const assignments = await db
      .select()
      .from(pastoralAssignments)
      .where(eq(pastoralAssignments.churchId, id));

    const pastorTable = pastors;
    const pastorIds = assignments.map((a) => a.pastorId);
    const allPastors =
      pastorIds.length > 0
        ? await db
            .select()
            .from(pastorTable)
            .where(inArray(pastorTable.id, pastorIds))
        : [];

    const pastorMap = new Map(allPastors.map((p) => [p.id, p]));

    return c.json({
      pastors: assignments.map((a) => {
        const p = pastorMap.get(a.pastorId);
        return {
          id: p?.id ?? null,
          name: p?.fullName ?? 'Unknown',
          title: p?.title ?? null,
          phone: p?.phone ?? null,
          role: a.role,
        };
      }),
    });
  })
  .get('/', async (c) => {
    const region = c.req.query('region') || 'ALL';
    const form = c.req.query('form') || 'ALL';
    const legalType = c.req.query('legalType') || 'ALL';
    const province = c.req.query('province') || 'TP. HCM';
    const q = (c.req.query('q') || '').trim().toLowerCase();
    const page = Math.max(Number(c.req.query('page')) || 1, 1);
    const limit = Math.max(Number(c.req.query('limit')) || 20, 1);

    if (!db) {
      let list = memoryStore.churches;

      if (province && province !== 'ALL') {
        list = list.filter((item) => item.province === province);
      }
      if (region !== 'ALL') {
        list = list.filter((item) => item.regionCode === region);
      }
      if (form !== 'ALL') {
        list = list.filter((item) => item.form === form);
      }
      if (legalType !== 'ALL') {
        list = list.filter((item) => item.legalType === legalType);
      }
      if (q) {
        list = list.filter(
          (item) =>
            matchesPrefix(item.name, q) ||
            (item.pastorName && matchesPrefix(item.pastorName, q))
        );
      }

      // Attach affiliated sub-congregations count for Chi hội
      const childCountMap = new Map<number, number>();
      for (const item of memoryStore.churches) {
        if (item.parentChurchId) {
          childCountMap.set(
            item.parentChurchId,
            (childCountMap.get(item.parentChurchId) ?? 0) + 1
          );
        }
      }

      const enriched = list.map((item) => ({
        ...item,
        affiliatedCount: childCountMap.get(item.id) ?? 0,
      }));

      const memStart = (page - 1) * limit;
      return c.json({
        churches: enriched.slice(memStart, memStart + limit),
        total: enriched.length,
        page,
        limit,
        hasMore: memStart + limit < enriched.length,
      });
    }

    const [allChurches, allRegions, allAssignments, allPastors, allBranches] = await Promise.all([
      db.select().from(churches).orderBy(asc(churches.id)),
      db.select().from(regions),
      db.select().from(pastoralAssignments),
      db.select().from(pastors),
      db.select().from(churchBranches),
    ]);

    const regionMap = new Map(allRegions.map((r) => [r.id, r]));
    const pastorMap = new Map(allPastors.map((p) => [p.id, p]));

    // Build parent name lookup from churchBranches
    const churchMap = new Map(allChurches.map((c) => [c.id, c]));
    const parentNameMap = new Map<number, string>();
    for (const b of allBranches) {
      const parent = churchMap.get(b.parentChurchId);
      if (parent) {
        parentNameMap.set(b.childChurchId, parent.name);
      }
    }

    // Build assignment map prioritizing Quản nhiệm role for each church
    const assignmentByChurch = new Map<number, typeof allAssignments[0]>();
    for (const a of allAssignments) {
      if (!a.churchId) continue;
      const existing = assignmentByChurch.get(a.churchId);
      if (!existing) {
        assignmentByChurch.set(a.churchId, a);
      } else {
        // Prefer Quản nhiệm over other roles, and isPrimary over non-primary
        const existingIsQuanNhiem = existing.role === 'Quản nhiệm';
        const currentIsQuanNhiem = a.role === 'Quản nhiệm';
        if (currentIsQuanNhiem && !existingIsQuanNhiem) {
          assignmentByChurch.set(a.churchId, a);
        } else if (currentIsQuanNhiem === existingIsQuanNhiem) {
          if (a.isPrimary && !existing.isPrimary) {
            assignmentByChurch.set(a.churchId, a);
          }
        }
      }
    }

    const childCountMap = new Map<number, number>();
    for (const item of allChurches) {
      if (item.parentChurchId) {
        childCountMap.set(
          item.parentChurchId,
          (childCountMap.get(item.parentChurchId) ?? 0) + 1
        );
      }
    }

    let list = allChurches.map((item) => {
      const reg = regionMap.get(item.regionId);
      const assign = assignmentByChurch.get(item.id);
      const pastor = assign ? pastorMap.get(assign.pastorId) : undefined;
      const parentName = parentNameMap.get(item.id) ?? null;

      return {
        id: item.id,
        stt: item.stt,
        code: item.code,
        form: item.form,
        legalType: item.legalType,
        autonomy: item.autonomy,
        name: item.name,
        shortName: item.shortName,
        parentChurchId: item.parentChurchId,
        parentChurchName: parentName,
        regionCode: reg?.code ?? 'I',
        regionName: reg?.name ?? 'Khu vực I',
        foundedYear: item.foundedYear,
        oldWard: item.oldWard,
        oldAddress: item.oldAddress,
        newAddress: item.newAddress,
        newWard: item.newWard,
        province: item.province,
        isInHcm: item.isInHcm,
        memberCount: item.memberCount,
        regularAttendanceCount: item.regularAttendanceCount,
        note: item.note,
        pastorName: pastor?.fullName ?? null,
        pastorTitle: pastor?.title ?? null,
        pastorRole: assign?.role ?? null,
        pastorPhone: pastor?.phone
          ? pastor.phone.replace(/\s+/g, '').trim()
          : null,
        affiliatedCount: childCountMap.get(item.id) ?? 0,
      };
    });

    if (province && province !== 'ALL') list = list.filter((x) => x.province === province);
    if (region !== 'ALL') list = list.filter((x) => x.regionCode === region);
    if (form !== 'ALL') list = list.filter((x) => x.form === form);
    if (legalType !== 'ALL') list = list.filter((x) => x.legalType === legalType);
    if (q) {
      list = list.filter(
        (item) =>
          matchesPrefix(item.name, q) ||
          (item.pastorName && matchesPrefix(item.pastorName, q)) ||
          (item.parentChurchName && matchesPrefix(item.parentChurchName, q))
      );
    }

    const start = (page - 1) * limit;
    const pageList = list.slice(start, start + limit);
    return c.json({
      churches: pageList,
      total: list.length,
      page,
      limit,
      hasMore: start + limit < list.length,
    });
  })
  .post('/', requireAdmin(), zValidator('json', createChurchSchema), async (c) => {
    const body = c.req.valid('json');
    const prefix =
      body.form === 'Chi hội' ? 'CH' : body.form === 'Hội nhánh' ? 'HN' : 'DN';

    if (!db) {
      const nextStt = memoryStore.nextChurchId++;
      const created = {
        id: nextStt,
        stt: nextStt,
        code: `${prefix}-${String(nextStt).padStart(3, '0')}`,
        form: body.form,
        legalType: body.legalType,
        autonomy: body.form === 'Chi hội' ? (body.autonomy ?? 'Tự dưỡng') : null,
        name: body.name.toUpperCase(),
        shortName: body.name.toUpperCase(),
        parentChurchId: null,
        parentChurchName: body.parentChurchName || null,
        regionCode: body.regionCode,
        regionName: `Khu vực ${body.regionCode}`,
        foundedYear: body.foundedYear ?? 2026,
        oldWard: null,
        oldAddress: body.oldAddress || null,
        newAddress: body.newAddress,
        newWard: body.newWard,
        isInHcm: true,
        memberCount: body.memberCount,
        regularAttendanceCount: body.regularAttendanceCount ?? 0,
        note: null,
        pastorName: body.pastorName || null,
        pastorTitle: 'Mục sư',
        pastorRole: body.pastorRole,
        pastorPhone: body.pastorPhone || null,
        pastorEmail: null,
      };
      memoryStore.churches = [created, ...memoryStore.churches];
      return c.json({ church: created }, 201);
    }

    const [reg] = await db
      .select()
      .from(regions)
      .where(eq(regions.code, body.regionCode));

    const allExisting = await db.select({ stt: churches.stt }).from(churches);
    const maxStt = allExisting.reduce((m, r) => Math.max(m, r.stt), 0) + 1;

    const [created] = await db
      .insert(churches)
      .values({
        stt: maxStt,
        code: `${prefix}-${String(maxStt).padStart(3, '0')}`,
        form: body.form,
        legalType: body.legalType,
        autonomy: body.form === 'Chi hội' ? (body.autonomy ?? 'Tự dưỡng') : null,
        name: body.name.toUpperCase(),
        shortName: body.name.toUpperCase(),
        parentChurchName: body.parentChurchName || null,
        regionId: reg?.id ?? 1,
        foundedYear: body.foundedYear ?? 2026,
        oldAddress: body.oldAddress || null,
        newAddress: body.newAddress,
        newWard: body.newWard,
        memberCount: body.memberCount,
        regularAttendanceCount: body.regularAttendanceCount ?? 0,
      })
      .returning();

    if (body.pastorName) {
      const [pastor] = await db
        .insert(pastors)
        .values({
          fullName: body.pastorName,
          title: 'Mục sư',
          phone: body.pastorPhone || null,
        })
        .returning();

      await db.insert(pastoralAssignments).values({
        churchId: created.id,
        pastorId: pastor.id,
        role: body.pastorRole,
        isPrimary: true,
      });
    }

    return c.json({ church: created }, 201);
  })
  .patch(
    '/:id',
    requireAdmin(),
    zValidator('param', idParam),
    zValidator('json', updateChurchSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');

      if (!db) {
        const idx = memoryStore.churches.findIndex((x) => x.id === id);
        if (idx === -1) return c.json({ error: 'Congregation not found' }, 404);
        memoryStore.churches[idx] = { ...memoryStore.churches[idx], ...body };
        return c.json({ church: memoryStore.churches[idx] });
      }

      const [updated] = await db
        .update(churches)
        .set(body)
        .where(eq(churches.id, id))
        .returning();

      if (!updated) return c.json({ error: 'Congregation not found' }, 404);
      return c.json({ church: updated });
    }
  )
  // Get pastors for a church
  .get('/:id/pastors', zValidator('param', idParam), async (c) => {
    const { id } = c.req.valid('param');

    if (!db) return c.json({ error: 'Database not available' }, 500);

    const assignments = await db
      .select()
      .from(pastoralAssignments)
      .where(eq(pastoralAssignments.churchId, id));

    const pastorIds = assignments.map((a) => a.pastorId);
    const allPastors =
      pastorIds.length > 0
        ? await db.select().from(pastors).where(inArray(pastors.id, pastorIds))
        : [];

    const pastorMap = new Map(allPastors.map((p) => [p.id, p]));

    return c.json({
      pastors: assignments.map((a) => {
        const p = pastorMap.get(a.pastorId);
        return {
          id: p?.id ?? null,
          name: p?.fullName ?? 'Unknown',
          title: p?.title ?? null,
          phone: p?.phone ?? null,
          role: a.role,
          isPrimary: a.isPrimary,
          assignmentType: a.assignmentType,
          workName: a.workName,
        };
      }),
    });
  })
  // Add pastor to church
  .post(
    '/:id/pastors',
    requireAdmin(),
    zValidator('param', idParam),
    zValidator('json', assignmentSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const body = c.req.valid('json');

      if (!db) return c.json({ error: 'Database not available' }, 500);

      const [church] = await db.select().from(churches).where(eq(churches.id, id));
      if (!church) return c.json({ error: 'Congregation not found' }, 404);

      const [pastor] = await db.select().from(pastors).where(eq(pastors.id, body.pastorId));
      if (!pastor) return c.json({ error: 'Pastor not found' }, 404);

      // If adding a Quản nhiệm, ensure only one exists
      if (body.role === 'Quản nhiệm' && body.isPrimary) {
        await db
          .update(pastoralAssignments)
          .set({ isPrimary: false })
          .where(
            and(
              eq(pastoralAssignments.churchId, id),
              eq(pastoralAssignments.role, 'Quản nhiệm'),
            ),
          );
      }

      const [assignment] = await db
        .insert(pastoralAssignments)
        .values({
          churchId: id,
          pastorId: body.pastorId,
          role: body.role,
          isPrimary: body.isPrimary,
          assignmentType: body.assignmentType,
          workName: body.workName,
        })
        .returning();

      return c.json({ assignment }, 201);
    }
  )
  // Update pastor assignment
  .patch(
    '/:id/pastors/:assignmentId',
    requireAdmin(),
    zValidator('param', idParam.extend({ assignmentId: z.coerce.number().int().positive() })),
    zValidator('json', updateAssignmentSchema),
    async (c) => {
      const { id, assignmentId } = c.req.valid('param');
      const body = c.req.valid('json');

      if (!db) return c.json({ error: 'Database not available' }, 500);

      const [assignment] = await db
        .select()
        .from(pastoralAssignments)
        .where(
          and(
            eq(pastoralAssignments.id, assignmentId),
            eq(pastoralAssignments.churchId, id),
          ),
        );

      if (!assignment) return c.json({ error: 'Assignment not found' }, 404);

      // If setting as Quản nhiệm and primary, unset others
      if (body.role === 'Quản nhiệm' && body.isPrimary) {
        await db
          .update(pastoralAssignments)
          .set({ isPrimary: false })
          .where(
            and(
              eq(pastoralAssignments.churchId, id),
              eq(pastoralAssignments.role, 'Quản nhiệm'),
            ),
          );
      }

      const [updated] = await db
        .update(pastoralAssignments)
        .set(body)
        .where(eq(pastoralAssignments.id, assignmentId))
        .returning();

      return c.json({ assignment: updated });
    }
  )
  // Remove pastor from church
  .delete(
    '/:id/pastors/:assignmentId',
    requireAdmin(),
    zValidator('param', idParam.extend({ assignmentId: z.coerce.number().int().positive() })),
    async (c) => {
      const { id, assignmentId } = c.req.valid('param');

      if (!db) return c.json({ error: 'Database not available' }, 500);

      const [assignment] = await db
        .select()
        .from(pastoralAssignments)
        .where(
          and(
            eq(pastoralAssignments.id, assignmentId),
            eq(pastoralAssignments.churchId, id),
          ),
        );

      if (!assignment) return c.json({ error: 'Assignment not found' }, 404);

      await db.delete(pastoralAssignments).where(eq(pastoralAssignments.id, assignmentId));

      return c.json({ success: true });
    }
  );
