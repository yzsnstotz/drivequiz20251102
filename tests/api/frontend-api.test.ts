// ============================================================
// 测试文件: tests/api/frontend-api.test.ts
// 功能: 前台 API 接口测试（200/4xx/404 基线）
// 覆盖: /api/profile, /api/interests, /api/vehicles, /api/services, /api/ads, /api/user-behaviors
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as ProfileGET, PUT as ProfilePUT } from "@/app/api/profile/route";
import { GET as InterestsGET, PUT as InterestsPUT } from "@/app/api/interests/route";
import { GET as VehiclesGET } from "@/app/api/vehicles/route";
import { GET as ServicesGET } from "@/app/api/services/route";
import { GET as AdsGET } from "@/app/api/ads/route";
import { POST as UserBehaviorsPOST } from "@/app/api/user-behaviors/route";
import { GET as ExamGET } from "@/app/api/exam/[set]/route";
import { db } from "@/lib/db";
import { getUserInfo } from "@/app/api/_lib/withUserAuth";
import * as fs from "fs";
import path from "path";

// Mock 数据库
vi.mock("@/lib/db", () => ({
  db: {
    selectFrom: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        select: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                offset: vi.fn(() => ({
                  execute: vi.fn(() => Promise.resolve([])),
                })),
              })),
            })),
            executeTakeFirst: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      })),
      select: vi.fn(() => ({
        where: vi.fn(() => ({
          executeTakeFirst: vi.fn(() => Promise.resolve({ count: 0 })),
        })),
      })),
    })),
    updateTable: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => ({
            executeTakeFirst: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      })),
    })),
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => ({
          executeTakeFirst: vi.fn(() => Promise.resolve(null)),
        })),
      })),
    })),
  },
}));

// Mock 用户认证
vi.mock("@/app/api/_lib/withUserAuth", () => ({
  getUserInfo: vi.fn(() => Promise.resolve({ userDbId: 1 })),
}));

// Mock 文件系统
vi.mock("fs", () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => JSON.stringify({ questions: [] })),
  },
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => JSON.stringify({ questions: [] })),
}));

describe("前台 API 接口测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // /api/profile 接口测试
  // ============================================================
  describe("GET /api/profile", () => {
    it("应返回 200 和用户资料（已登录）", async () => {
      const mockProfile = {
        id: 1,
        language: "ja",
        goals: [],
        level: "beginner",
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.selectFrom as any).mockReturnValue({
        select: vi.fn(() => ({
          where: vi.fn(() => ({
            executeTakeFirst: vi.fn(() => Promise.resolve(mockProfile)),
          })),
        })),
      });

      const req = new NextRequest("http://localhost/api/profile");
      const response = await ProfileGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toHaveProperty("language");
      expect(body.data).toHaveProperty("goals");
      expect(body.data).toHaveProperty("level");
    });

    it("应返回 401（未登录）", async () => {
      vi.mocked(getUserInfo).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/profile");
      const response = await ProfileGET(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("AUTH_REQUIRED");
    });
  });

  describe("PUT /api/profile", () => {
    it("应返回 200 和更新后的资料", async () => {
      const mockProfile = {
        id: 1,
        language: "zh",
        goals: [],
        level: "beginner",
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.selectFrom as any).mockReturnValue({
        select: vi.fn(() => ({
          where: vi.fn(() => ({
            executeTakeFirst: vi.fn(() => Promise.resolve({ id: 1 })),
          })),
        })),
      });

      (db.updateTable as any).mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => ({
              executeTakeFirst: vi.fn(() => Promise.resolve(mockProfile)),
            })),
          })),
        })),
      });

      const req = new NextRequest("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ language: "zh" }),
      });
      const response = await ProfilePUT(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.language).toBe("zh");
    });

    it("应返回 400（参数验证失败）", async () => {
      const req = new NextRequest("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ language: 123 }), // 无效类型
      });
      const response = await ProfilePUT(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
    });
  });

  // ============================================================
  // /api/interests 接口测试
  // ============================================================
  describe("GET /api/interests", () => {
    it("应返回 200 和用户兴趣", async () => {
      const mockInterests = {
        id: 1,
        vehicle_brands: ["Toyota"],
        service_types: ["inspection"],
        other_interests: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      (db.selectFrom as any).mockReturnValue({
        select: vi.fn(() => ({
          where: vi.fn(() => ({
            executeTakeFirst: vi.fn(() => Promise.resolve(mockInterests)),
          })),
        })),
      });

      const req = new NextRequest("http://localhost/api/interests");
      const response = await InterestsGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toHaveProperty("vehicle_brands");
      expect(body.data).toHaveProperty("service_types");
    });

    it("应返回 401（未登录）", async () => {
      vi.mocked(getUserInfo).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/interests");
      const response = await InterestsGET(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("AUTH_REQUIRED");
    });
  });

  // ============================================================
  // /api/vehicles 接口测试
  // ============================================================
  describe("GET /api/vehicles", () => {
    it("应返回 200 和车辆列表（带分页）", async () => {
      const mockVehicles = [
        {
          id: 1,
          brand: "Toyota",
          model: "Camry",
          name_ja: "トヨタ カムリ",
          name_zh: "丰田 凯美瑞",
          name_en: "Toyota Camry",
          price_min: 2000000,
          price_max: 3000000,
        },
      ];

      (db.selectFrom as any).mockReturnValue({
        leftJoin: vi.fn(() => ({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                  offset: vi.fn(() => ({
                    execute: vi.fn(() => Promise.resolve(mockVehicles)),
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      (db.selectFrom as any).mockReturnValueOnce({
        leftJoin: vi.fn(() => ({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              select: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => Promise.resolve({ count: 1 })),
              })),
            })),
          })),
        })),
      });

      const req = new NextRequest("http://localhost/api/vehicles?page=1&limit=5");
      const response = await VehiclesGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("total");
    });

    it("应支持筛选参数", async () => {
      const req = new NextRequest("http://localhost/api/vehicles?brand=Toyota&type=轿车");
      const response = await VehiclesGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });
  });

  // ============================================================
  // /api/services 接口测试
  // ============================================================
  describe("GET /api/services", () => {
    it("应返回 200 和服务列表（带分页）", async () => {
      const mockServices = [
        {
          id: 1,
          name: "驾校服务",
          name_ja: "教習所サービス",
          name_zh: "驾校服务",
          name_en: "Driving School Service",
          prefecture: "东京都",
          city: "新宿区",
          price_min: 300000,
          price_max: 500000,
          category_name: "inspection",
          category_name_ja: "車検",
          category_name_zh: "车检",
          category_name_en: "Inspection",
        },
      ];

      // Mock count query (first call)
      (db.selectFrom as any)
        .mockReturnValueOnce({
          leftJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                select: vi.fn(() => ({
                  executeTakeFirst: vi.fn(() => Promise.resolve({ count: 1 })),
                })),
              })),
            })),
          })),
        })
        // Mock data query (second call)
        .mockReturnValueOnce({
          leftJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn(() => ({
                      execute: vi.fn(() => Promise.resolve(mockServices)),
                    })),
                  })),
                })),
              })),
            })),
          })),
        });

      const req = new NextRequest("http://localhost/api/services?page=1&limit=5");
      const response = await ServicesGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toHaveProperty("page");
      expect(body.pagination).toHaveProperty("total");
    });

    it("应支持筛选参数", async () => {
      // Mock count query
      (db.selectFrom as any)
        .mockReturnValueOnce({
          leftJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  where: vi.fn(() => ({
                    select: vi.fn(() => ({
                      executeTakeFirst: vi.fn(() => Promise.resolve({ count: 0 })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        })
        // Mock data query
        .mockReturnValueOnce({
          leftJoin: vi.fn(() => ({
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        offset: vi.fn(() => ({
                          execute: vi.fn(() => Promise.resolve([])),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        });

      const req = new NextRequest("http://localhost/api/services?category=inspection&prefecture=东京都");
      const response = await ServicesGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });
  });

  // ============================================================
  // /api/ads 接口测试
  // ============================================================
  describe("GET /api/ads", () => {
    it("应返回 200 和广告内容", async () => {
      const mockSlot = {
        id: 1,
        position: "license_top",
        name: "驾照页面顶部",
        status: "active",
      };

      const mockAd = {
        id: 1,
        slot_id: 1,
        title: "广告标题",
        image_url: "https://example.com/ad.jpg",
        link_url: "https://example.com",
      };

      (db.selectFrom as any)
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => Promise.resolve(mockSlot)),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  where: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      orderBy: vi.fn(() => ({
                        execute: vi.fn(() => Promise.resolve([mockAd])),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          })),
        });

      const req = new NextRequest("http://localhost/api/ads?position=license_top");
      const response = await AdsGET(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toHaveProperty("title");
    });

    it("应返回 400（缺少position参数）", async () => {
      const req = new NextRequest("http://localhost/api/ads");
      const response = await AdsGET(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
    });
  });

  // ============================================================
  // /api/user-behaviors 接口测试
  // ============================================================
  describe("POST /api/user-behaviors", () => {
    it("应返回 200 和记录的行为", async () => {
      // Mock activation lookup (first call: find activation by id)
      (db.selectFrom as any)
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              executeTakeFirst: vi.fn(() => Promise.resolve({ id: 1, email: "test@example.com" })),
            })),
          })),
        })
        // Second call: find user by email
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            where: vi.fn(() => ({
              executeTakeFirst: vi.fn(() => Promise.resolve({ id: 1, email: "test@example.com" })),
            })),
          })),
        });
      
      // Mock insertInto for user_behaviors
      (db.insertInto as any).mockReturnValue({
        values: vi.fn(() => ({
          execute: vi.fn(() => Promise.resolve([])),
        })),
      });

      const req = new NextRequest("http://localhost/api/user-behaviors", {
        method: "POST",
        headers: {
          authorization: "Bearer act-00000001",
        },
        body: JSON.stringify({
          behaviorType: "view_page",
          metadata: { page: "/vehicles" },
        }),
      });
      const response = await UserBehaviorsPOST(req);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("应返回 401（缺少token）", async () => {
      const req = new NextRequest("http://localhost/api/user-behaviors", {
        method: "POST",
        body: JSON.stringify({
          behaviorType: "view_page",
        }),
      });
      const response = await UserBehaviorsPOST(req);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("NO_TOKEN");
    });

    it("应返回 400（无效的行为类型）", async () => {
      const req = new NextRequest("http://localhost/api/user-behaviors", {
        method: "POST",
        headers: {
          authorization: "Bearer act-123",
        },
        body: JSON.stringify({
          behaviorType: "invalid_type",
        }),
      });
      const response = await UserBehaviorsPOST(req);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("INVALID_BEHAVIOR_TYPE");
    });
  });

  // ============================================================
  // /api/exam/[set] 接口测试
  // ============================================================
  describe("GET /api/exam/[set]", () => {
    it("应返回 200 和题目列表", async () => {
      const mockQuestions = [
        {
          id: 1,
          type: "single",
          content: "题目内容",
          options: ["选项A", "选项B"],
          correctAnswer: "选项A",
        },
      ];

      // Mock file system
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ questions: mockQuestions })
      );

      const req = new NextRequest("http://localhost/api/exam/1?licenseType=provisional&page=1&limit=10");
      const response = await ExamGET(req, { params: Promise.resolve({ set: "1" }) });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination).toHaveProperty("page");
    });

    it("应返回 400（无效的licenseType）", async () => {
      const req = new NextRequest("http://localhost/api/exam/1?licenseType=invalid");
      const response = await ExamGET(req, { params: Promise.resolve({ set: "1" }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("VALIDATION_FAILED");
    });

    it("应返回 404（题目集不存在）", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const req = new NextRequest("http://localhost/api/exam/nonexistent?licenseType=provisional");
      const response = await ExamGET(req, { params: Promise.resolve({ set: "nonexistent" }) });
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.ok).toBe(false);
      expect(body.errorCode).toBe("NOT_FOUND");
    });
  });
});

