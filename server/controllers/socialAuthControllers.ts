import { Request, Response } from "express";
import zernio from "../config/zernio.js";
import { User } from "../models/user.js";
import { Account } from "../models/Account.js";
import { AuthRequest } from "../middlewares/authMiddleware.js";

type AuthenticatedRequest = Request & {
  user: any;
};

// Helper to ensure user has a Zernio Profile
const getOrCreateZernioProfile = async (user: any): Promise<string> => {
  try {
    // First, use the profile already saved for this user
    if (user.zernioProfileId) {
      return user.zernioProfileId.toString();
    }

    // Check existing Zernio profiles
    const result = await zernio.profiles.listProfiles();

    const data = result.data as any;

    const profiles: any[] = Array.isArray(data)
      ? data
      : data?.profiles || data?.data || [];

    if (profiles.length > 0) {
      const pid = profiles[0]._id || profiles[0].id;

      if (!pid) {
        throw new Error("Zernio profile found but no profile ID was returned");
      }

      await User.findByIdAndUpdate(user._id, {
        zernioProfileId: pid,
      });

      return pid;
    }

    // Create a new profile if none exists
    const createResult = await zernio.profiles.createProfile({
      body: {
        name: `${user.name || user.email}'s workspace`,
      } as any,
    });

    const created = (createResult.data as any)?.profile || createResult.data;

    const pid = created?._id || created?.id;

    if (!pid) {
      throw new Error("Failed to create Zernio profile - no ID returned");
    }

    await User.findByIdAndUpdate(user._id, {
      zernioProfileId: pid,
    });

    return pid;
  } catch (error: any) {
    console.error("getOrCreateZernioProfile Error:", error?.message || error);

    throw error;
  }
};

// Generate OAuth authorization URL
// GET /api/auth/:platform
export const generateAuthUrl = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const { platform } = req.params;

    const profileId = await getOrCreateZernioProfile(req.user);

    const origin = req.headers.origin;

    if (!origin) {
      throw new Error("Request origin is missing");
    }

    const redirectUrl = `${origin}/accounts`;

    const result = await zernio.connect.getConnectUrl({
      path: {
        platform: platform as any,
      },
      query: {
        profileId,
        redirect_url: redirectUrl,
      },
    });

    const data = result.data as any;

    console.log("getConnectUrl response:", JSON.stringify(data, null, 2));

    const authUrl = data?.authUrl || data?.url;

    if (!authUrl) {
      throw new Error(
        `Zernio returned no authUrl. Full response: ${JSON.stringify(data)}`,
      );
    }

    res.json({
      url: authUrl,
    });
  } catch (error: any) {
    console.error("generateAuthUrl Error:", error?.message || error);

    res.status(500).json({
      message: error?.message || "Server error",
    });
  }
};

// Sync connected accounts from Zernio into MongoDB
// GET /api/auth/sync
export const syncAccounts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    // Get/create Zernio profile
    const profileId = await getOrCreateZernioProfile(req.user);

    // Get accounts from Zernio
    const result = await zernio.accounts.listAccounts({
      query: {
        profileId,
      } as any,
    });

    const data = result.data as any;

    const zernioAccounts: any[] = Array.isArray(data)
      ? data
      : data?.accounts || data?.data || [];

    const supportedPlatforms = ["twitter", "linkedin", "facebook", "instagram"];

    const syncedAccounts: any[] = [];

    // Process every Zernio account
    for (const zAccount of zernioAccounts) {
      const zid = zAccount?._id || zAccount?.id;

      // Skip account if it doesn't have an ID
      if (!zid) {
        console.warn("Skipping account with no ID:", zAccount);
        continue;
      }

      // Normalize platform name
      const rawPlatform = (
        zAccount.platform ||
        zAccount.type ||
        ""
      ).toLowerCase();

      const normalizedPlatform = supportedPlatforms.find((platform) =>
        rawPlatform.includes(platform),
      );

      // Skip unsupported platforms
      if (!normalizedPlatform) {
        console.log(`Skipping unsupported platform: "${rawPlatform}"`);
        continue;
      }

      // Save/update account in MongoDB
      const account = await Account.findOneAndUpdate(
        {
          zernioAccountId: zid,
        },
        {
          user: req.user._id,
          platform: normalizedPlatform,
          handle:
            zAccount.username || zAccount.name || zAccount.handle || "Unknown",
          zernioAccountId: zid,
          status: "connected",
          avatarUrl:
            zAccount.avatarUrl ||
            zAccount.picture ||
            zAccount.profile_image_url ||
            null,
        },
        {
          upsert: true,
          new: true,
        },
      );

      syncedAccounts.push(account);
    }

    // Return synced accounts
    res.json({
      success: true,
      accounts: syncedAccounts,
    });
  } catch (error: any) {
    console.error("syncAccounts Error:", error?.message || error);

    res.status(500).json({
      message: error?.message || "Server error",
    });
  }
};
