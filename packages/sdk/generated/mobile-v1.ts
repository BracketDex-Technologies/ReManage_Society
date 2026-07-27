export interface paths {
    "/api/mobile/v1/auth/otp/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MobileAuthController_requestOtp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/auth/otp/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MobileAuthController_verifyOtp"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MobileAuthController_password"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/session/active-role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["MobileSessionController_activeRole"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/session/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["MobileSessionController_bootstrap"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/session/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MobileSessionController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/mobile/v1/session/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["MobileSessionController_refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        LogoutMobileSessionDto: {
            renewableCredential: string;
        };
        LogoutMobileSessionResponseDto: {
            /** @enum {boolean} */
            loggedOut: true;
        };
        MobileBootstrapDto: {
            user: components["schemas"]["MobileBootstrapUserDto"];
            society: components["schemas"]["MobileBootstrapSocietyDto"];
            approvedRoles: ("resident" | "guard")[];
            /** @enum {string} */
            activeRole: "resident" | "guard";
            permissions: string[];
            featureFlags: components["schemas"]["MobileFeatureFlagsDto"];
            notificationPolicy: components["schemas"]["MobileNotificationPolicyDto"];
        };
        MobileBootstrapSocietyDto: {
            id: string;
            name: string;
        };
        MobileBootstrapUserDto: {
            id: string;
            name: string;
            /** Format: email */
            email: string;
        };
        MobileCommunityNotificationPolicyDto: {
            /** @enum {boolean} */
            enabled: false;
            /** @enum {boolean} */
            configurable: true;
        };
        MobileCriticalNotificationPolicyDto: {
            /** @enum {boolean} */
            enabled: true;
            /** @enum {boolean} */
            configurable: false;
        };
        MobileFeatureFlagsDto: {
            /** @enum {boolean} */
            residentShell: true;
            /** @enum {boolean} */
            guardShell: true;
            /** @enum {boolean} */
            nativePush: false;
            /** @enum {boolean} */
            guardOffline: false;
        };
        MobileInstallationDto: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            platform: "android" | "ios";
            /** @example 1.0.0 */
            appVersion: string;
            /** @example Pixel 9 */
            deviceName?: string;
        };
        MobileNotificationPolicyDto: {
            critical: components["schemas"]["MobileCriticalNotificationPolicyDto"];
            transactional: components["schemas"]["MobileTransactionalNotificationPolicyDto"];
            community: components["schemas"]["MobileCommunityNotificationPolicyDto"];
        };
        MobileRoleSwitchDto: {
            accessToken: string;
            /** Format: date-time */
            accessExpiresAt: string;
            bootstrap: components["schemas"]["MobileBootstrapDto"];
        };
        MobileSessionIssueDto: {
            accessToken: string;
            /** Format: date-time */
            accessExpiresAt: string;
            renewableCredential: string;
            /** Format: date-time */
            renewableExpiresAt: string;
            deviceSessionId: string;
            /** @enum {string} */
            activeRole: "resident" | "guard";
        };
        MobileTransactionalNotificationPolicyDto: {
            /** @enum {boolean} */
            enabled: true;
            /** @enum {boolean} */
            configurable: true;
        };
        OtpRequestAcceptedDto: {
            accepted: boolean;
            /** Format: uuid */
            challengeId: string;
        };
        OtpRequestDto: {
            /** Format: email */
            identifier: string;
            installation: components["schemas"]["MobileInstallationDto"];
        };
        OtpVerifyDto: {
            /** Format: uuid */
            challengeId: string;
            code: string;
            installation: components["schemas"]["MobileInstallationDto"];
        };
        PasswordLoginRequestDto: {
            /** Format: email */
            identifier: string;
            password: string;
            installation: components["schemas"]["MobileInstallationDto"];
        };
        RefreshMobileSessionDto: {
            renewableCredential: string;
        };
        UpdateMobileActiveRoleDto: {
            /** @enum {string} */
            role: "resident" | "guard";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    MobileAuthController_requestOtp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OtpRequestDto"];
            };
        };
        responses: {
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OtpRequestAcceptedDto"];
                };
            };
        };
    };
    MobileAuthController_verifyOtp: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OtpVerifyDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MobileSessionIssueDto"];
                };
            };
        };
    };
    MobileAuthController_password: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordLoginRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MobileSessionIssueDto"];
                };
            };
        };
    };
    MobileSessionController_activeRole: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateMobileActiveRoleDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MobileRoleSwitchDto"];
                };
            };
        };
    };
    MobileSessionController_bootstrap: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MobileBootstrapDto"];
                };
            };
        };
    };
    MobileSessionController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LogoutMobileSessionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LogoutMobileSessionResponseDto"];
                };
            };
        };
    };
    MobileSessionController_refresh: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefreshMobileSessionDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MobileSessionIssueDto"];
                };
            };
        };
    };
}
