import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { eq, inArray } from 'drizzle-orm';

async function createPastoralAssignments() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Missing DATABASE_URL or DIRECT_URL in .env');
    process.exit(1);
  }

  console.log('🌱 Connecting to PostgreSQL...');
  const client = postgres(connectionString, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  // Get all pastors from database
  const dbPastors = await db.select().from(schema.pastors);
  console.log(`📊 Found ${dbPastors.length} pastors in database`);

  // Get all churches from database
  const dbChurches = await db.select().from(schema.churches);
  console.log(`📊 Found ${dbChurches.length} churches in database`);

  // Get all regions from database
  const dbRegions = await db.select().from(schema.regions);
  console.log(`📊 Found ${dbRegions.length} regions in database`);

  // Build church lookup by shortName and name (uppercase)
  const churchByShortName = new Map<string, typeof dbChurches[0]>();
  const churchByName = new Map<string, typeof dbChurches[0]>();
  dbChurches.forEach((c) => {
    if (c.shortName) churchByShortName.set(c.shortName.toUpperCase(), c);
    if (c.name) churchByName.set(c.name.toUpperCase(), c);
  });

  // Build parent-child church lookup from churchBranches table
  const childChurchesByParent = new Map<number, typeof dbChurches[]>();
  dbChurches.forEach((c) => {
    // Will be populated from churchBranches
  });

  // Build church lookup by regionId
  const churchesByRegionId = new Map<number, typeof dbChurches[]>();
  dbChurches.forEach((c) => {
    if (c.regionId) {
      const existing = churchesByRegionId.get(c.regionId) || [];
      existing.push(c);
      churchesByRegionId.set(c.regionId, existing);
    }
  });

  // Build region lookup by code
  const regionByCode = new Map<string, typeof dbRegions[0]>();
  dbRegions.forEach((r) => {
    if (r.code) regionByCode.set(r.code.toUpperCase(), r);
  });

  // Get churchBranches to link parents and children
  const allBranches = await db.select().from(schema.churchBranches);
  for (const branch of allBranches) {
    const parent = dbChurches.find(c => c.id === branch.parentChurchId);
    const child = dbChurches.find(c => c.id === branch.childChurchId);
    if (parent && child) {
      const existing = childChurchesByParent.get(parent.id) || [];
      existing.push(child);
      childChurchesByParent.set(parent.id, existing);
    }
  }

  // Mapping from common region names to region codes
  const regionNameToCode: Record<string, string> = {
    'SÀI GÒN': 'I',
    'SAI GON': 'I',
    'TP HCM': 'I',
    'TP. HCM': 'I',
    'TP.HCM': 'I',
    'THỦ ĐỨC': 'II',
    'THU DUC': 'II',
    'KV II': 'II',
    'TÂN BÌNH': 'III',
    'TAN BINH': 'III',
    'TÂN PHÚ': 'III',
    'TAN PHU': 'III',
    'PHÚ NHUẬN': 'III',
    'PHU NHUAN': 'III',
    'BÌNH THẠNH': 'III',
    'BINH THANH': 'III',
    'GÒ VẤP': 'III',
    'GO VAP': 'III',
    'KV III': 'III',
    'QUẬN 6': 'IV',
    'QUAN 6': 'IV',
    'QUẬN 11': 'IV',
    'QUAN 11': 'IV',
    'BÌNH TÂN': 'IV',
    'BINH TAN': 'IV',
    'QUẬN 12': 'IV',
    'QUAN 12': 'IV',
    'HÓC MÔN': 'IV',
    'HOC MON': 'IV',
    'CỦ CHI': 'IV',
    'CU CHI': 'IV',
    'KV IV': 'IV',
    'BÌNH DƯƠNG': 'V',
    'BINH DUONG': 'V',
    'THỦ DẦU MỘT': 'V',
    'THU DAU MOT': 'V',
    'THUẬN AN': 'V',
    'THUAN AN': 'V',
    'DĨ AN': 'V',
    'DI AN': 'V',
    'BẾN CÁT': 'V',
    'BEN CAT': 'V',
    'TÂN UYÊN': 'V',
    'TAN UYEN': 'V',
    'KV V': 'V',
    'BÀ RỊA': 'VI',
    'BA RIA': 'VI',
    'VŨNG TÀU': 'VI',
    'VUNG TAU': 'VI',
    'PHÚ MỸ': 'VI',
    'PHU MY': 'VI',
    'CHÂU ĐỨC': 'VI',
    'CHAU DUC': 'VI',
    'XUYÊN MỘC': 'VI',
    'XUYEN MOC': 'VI',
    'LONG ĐIỆN': 'VI',
    'LONG DIEN': 'VI',
    'KV VI': 'VI',
  };

  // Build pastor lookup by ten_nhiem_so (uppercase) - also support partial matching
  const pastorByTenNhiemSo = new Map<string, typeof dbPastors[0][]>();
  const pastorByTenNhiemSoPartial = new Map<string, typeof dbPastors[0][]>();
  dbPastors.forEach((p) => {
    if (p.tenNhiemSo) {
      const key = p.tenNhiemSo.toUpperCase();
      const existing = pastorByTenNhiemSo.get(key) || [];
      existing.push(p);
      pastorByTenNhiemSo.set(key, existing);
      
      // Also index by individual components (split by ;)
      const parts = p.tenNhiemSo.split(/[;,]/).map(s => s.trim().toUpperCase());
      for (const part of parts) {
        if (part.length > 2) {
          const existingPartial = pastorByTenNhiemSoPartial.get(part) || [];
          existingPartial.push(p);
          pastorByTenNhiemSoPartial.set(part, existingPartial);
        }
      }
    }
  });

  // Clear existing assignments
  console.log('🗑️  Clearing existing pastoral assignments...');
  await db.delete(schema.pastoralAssignments);

  // Match and create assignments
  let linkedParents = 0;
  let linkedPastors = 0;
  let regionLinked = 0;
  let branchLinked = 0;
  let specialLinked = 0;
  let skipped = 0;

  const assignedPastorIds = new Set<number>();

  // Step 1: Match pastors to Chi hội by name/shortName
  for (const church of dbChurches) {
    if (church.form !== 'Chi hội') continue;
    
    const key = church.shortName?.toUpperCase() || church.name?.toUpperCase();
    let matchingPastors = pastorByTenNhiemSo.get(key) || [];
    
    // Fallback: partial match on tenNhiemSo components
    if (matchingPastors.length === 0 && church.name) {
      const nameUpper = church.name.toUpperCase();
      matchingPastors = pastorByTenNhiemSoPartial.get(nameUpper) || [];
    }
    
    // Also try matching church shortName in partial
    if (matchingPastors.length === 0 && church.shortName) {
      const shortUpper = church.shortName.toUpperCase();
      matchingPastors = pastorByTenNhiemSoPartial.get(shortUpper) || [];
    }

    if (matchingPastors.length > 0) {
      for (const pastor of matchingPastors) {
        if (assignedPastorIds.has(pastor.id)) continue;
        
        await db.insert(schema.pastoralAssignments).values({
          churchId: church.id,
          pastorId: pastor.id,
          role: pastor.chucVu || 'Quản nhiệm',
          isPrimary: true,
          assignmentType: 'church',
        });
        assignedPastorIds.add(pastor.id);
        linkedPastors++;
      }
    } else {
      skipped++;
    }
  }

  // Step 2: Assign Điểm nhóm/Hội nhánh to their parent Chi hội's pastor
  for (const [parentId, children] of childChurchesByParent.entries()) {
    const parentAssignments = await db.select()
      .from(schema.pastoralAssignments)
      .where(eq(schema.pastoralAssignments.churchId, parentId));
    
    // Check for Quản nhiệm role (may be combined like "Quản nhiệm; Kiêm nhiệm")
    const quanNhiemAssign = parentAssignments.find(a => 
      a.role && a.role.toLowerCase().includes('quản nhiệm')
    );
    
    if (quanNhiemAssign) {
      for (const child of children) {
        await db.insert(schema.pastoralAssignments).values({
          churchId: child.id,
          pastorId: quanNhiemAssign.pastorId,
          role: 'Đặc trách',
          isPrimary: false,
          assignmentType: 'church',
        });
        branchLinked++;
      }
    }
  }

  // Step 3: Parse pastor chucVu for specific branch assignments (e.g., "Đặc trách ĐN Tân Nhựt")
  for (const pastor of dbPastors) {
    if (!pastor.chucVu) continue;
    
    // Parse special assignments from chucVu
    // Patterns: "Đặc trách ĐN Tên", "Phụ tá - Đặc trách HN. Tên", "Đặc trách", etc.
    const specialMatches = [...pastor.chucVu.matchAll(/(?:Đặc trách|Phụ tá)[^;]*(?:ĐN|HN|Điểm nhóm|Hội nhánh)\.?\s*([^;]+)/gi)];
    
    for (const match of specialMatches) {
      const fullMatch = match[0];
      const branchName = match[1]?.trim();
      if (!branchName) continue;
      
      // Find the branch church by name
      const branchChurch = dbChurches.find(c => 
        c.name.toUpperCase().includes(branchName.toUpperCase()) ||
        (c.parentChurchName && c.name.toUpperCase().includes(branchName.toUpperCase()))
      );
      
      if (branchChurch) {
        // Check if assignment already exists
        const existing = await db.select()
          .from(schema.pastoralAssignments)
          .where(eq(schema.pastoralAssignments.churchId, branchChurch.id))
          .where(eq(schema.pastoralAssignments.pastorId, pastor.id));
        
        if (existing.length === 0) {
          await db.insert(schema.pastoralAssignments).values({
            churchId: branchChurch.id,
            pastorId: pastor.id,
            role: fullMatch.trim(),
            isPrimary: false,
            assignmentType: 'church',
          });
          specialLinked++;
        }
      }
    }
  }

  // Step 4: Handle region-based assignments
  for (const pastor of dbPastors) {
    if (!pastor.tenNhiemSo) continue;
    
    if (assignedPastorIds.has(pastor.id)) continue;
    
    const tenNhiemSoUpper = pastor.tenNhiemSo.toUpperCase();
    const regionCode = regionNameToCode[tenNhiemSoUpper];
    if (regionCode) {
      const region = regionByCode.get(regionCode);
      if (region) {
        const churchesInRegion = churchesByRegionId.get(region.id) || [];
        if (churchesInRegion.length > 0) {
          const representativeChurch = churchesInRegion[0];
          
          await db.insert(schema.pastoralAssignments).values({
            churchId: representativeChurch.id,
            pastorId: pastor.id,
            role: pastor.chucVu || 'Quản nhiệm',
            isPrimary: true,
            assignmentType: 'church',
          });
          assignedPastorIds.add(pastor.id);
          regionLinked++;
          continue;
        }
      }
    }
  }

  console.log(`✅ Created ${linkedPastors} pastoral assignments (Chi hội match)`);
  console.log(`✅ Created ${branchLinked} pastoral assignments (branch auto-link)`);
  console.log(`✅ Created ${specialLinked} pastoral assignments (special role parse)`);
  console.log(`✅ Created ${regionLinked} pastoral assignments (region match)`);
  console.log(`⏭️  Skipped ${skipped} Chi hội (no matching pastor)`);

  await client.end();
}

createPastoralAssignments().catch((err) => {
  console.error('❌ Create assignments failed:', err);
  process.exit(1);
});