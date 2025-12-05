import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
export interface JwtPayload {
    sub: string;
    email: string;
}
export interface AuthResponse {
    accessToken: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
    };
}
export declare class AuthService {
    private prisma;
    private jwtService;
    private readonly logger;
    private readonly SALT_ROUNDS;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    validateUser(payload: JwtPayload): Promise<{
        id: string;
        email: string;
        name: string | null;
        passwordHash: string;
        createdAt: Date;
        updatedAt: Date;
        preferences: import("@prisma/client/runtime/library").JsonValue;
    }>;
    getUserById(userId: string): Promise<{
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        preferences: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        name: string | null;
        createdAt: Date;
        preferences: import("@prisma/client/runtime/library").JsonValue;
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    deleteAccount(userId: string, password: string): Promise<{
        message: string;
    }>;
    private generateToken;
}
