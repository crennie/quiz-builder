import { createClient } from "@supabase/supabase-js";

import { config } from "../config";

export const supabase =
    config.supabaseUrl && config.supabasePublishableKey
        ? createClient(config.supabaseUrl, config.supabasePublishableKey)
        : null;
