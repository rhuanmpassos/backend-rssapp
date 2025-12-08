import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { User } from '@prisma/client';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<import("./auth.service").AuthResponse>;
    login(dto: LoginDto): Promise<import("./auth.service").AuthResponse>;
    getProfile(user: User): Promise<{
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        preferences: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    refreshToken(user: User): Promise<import("./auth.service").AuthResponse>;
    updateProfile(user: User, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        preferences: import("@prisma/client/runtime/library").JsonValue;
    }>;
    changePassword(user: User, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    deleteAccount(user: User, dto: DeleteAccountDto): Promise<{
        message: string;
    }>;
}
