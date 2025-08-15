// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  User Management (No Status Updates)
 * @dev Only Manager and Owner can create users. No active/inactive status.
 */
contract UserManagement {
    
    // ============ ENUMS & STRUCTS ============
    
    enum Role { Unregistered, Manager, Seller, Supplier }
    
    struct User {
        address walletAddress;      // User's wallet address
        Role role;                 // Assigned role
        uint256 registeredAt;      // When user was registered
        address registeredBy;      // Who registered this user
        string displayName;        // Display name
    }
    
    // ============ STATE VARIABLES ============
    
    address public owner;
    
    // Mappings
    mapping(address => User) public users;           // address → User info
    mapping(address => bool) public isRegistered;    // address → is registered
    
    // Arrays for easy iteration
    address[] public registeredUsers;
    
    // ============ EVENTS ============
    
    event UserCreated(address indexed userAddress, Role indexed role, address indexed createdBy, uint256 timestamp);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() { 
        require(msg.sender == owner, "Only owner can perform this action"); 
        _; 
    }
    
    modifier onlyOwnerOrManager() {
        require(
            msg.sender == owner || users[msg.sender].role == Role.Manager, 
            "Only owner or manager can perform this action"
        );
        _;
    }
    
    constructor() { 
        owner = msg.sender;
        
        // Auto-register owner as Manager
        users[owner] = User({
            walletAddress: owner,
            role: Role.Manager,
            registeredAt: block.timestamp,
            registeredBy: owner,
            displayName: "System Owner"
        });
        
        isRegistered[owner] = true;
        registeredUsers.push(owner);
        
        emit UserCreated(owner, Role.Manager, owner, block.timestamp);
    }
    
    // ============ USER CREATION FUNCTION ============
    
    /**
     * @dev Create/Register a new user (Owner and Manager only)
     * @param userAddress Address of the user to register
     * @param role Role to assign to the user
     * @param displayName Display name for the user
     */
    function createUser(
        address userAddress, 
        Role role, 
        string memory displayName
    ) external onlyOwnerOrManager returns (bool) {
        require(userAddress != address(0), "Invalid user address");
        require(!isRegistered[userAddress], "User already registered");
        require(role != Role.Unregistered, "Cannot assign Unregistered role");
        require(bytes(displayName).length > 0, "Display name required");
        
        // Managers can only create Sellers and Suppliers
        if (msg.sender != owner) {
            require(
                role == Role.Seller || role == Role.Supplier, 
                "Managers can only create Sellers and Suppliers"
            );
        }
        
        uint256 timestamp = block.timestamp;
        
        // Create user record
        users[userAddress] = User({
            walletAddress: userAddress,
            role: role,
            registeredAt: timestamp,
            registeredBy: msg.sender,
            displayName: displayName
        });
        
        // Mark as registered and add to array
        isRegistered[userAddress] = true;
        registeredUsers.push(userAddress);
        
        emit UserCreated(userAddress, role, msg.sender, timestamp);
        return true;
    }
    
    // ============ USER ROLE & DETAILS FUNCTIONS ============
    
    /**
     * @dev Get user role and basic info (Main function for UI authentication)
     * @param userAddress Address to check
     * @return role User's role
     * @return displayName User's display name
     * @return registeredAt When user was registered
     */
    function getUserRole(address userAddress) external view returns (
        Role role, 
        string memory displayName,
        uint256 registeredAt
    ) {
        if (!isRegistered[userAddress]) {
            return (Role.Unregistered, "", 0);
        }
        
        User memory user = users[userAddress];
        return (user.role, user.displayName, user.registeredAt);
    }
    
    /**
     * @dev Get complete user details
     * @param userAddress Address to check
     * @return user Complete user information
     */
    function getUserDetails(address userAddress) external view returns (User memory user) {
        require(isRegistered[userAddress], "User not registered");
        return users[userAddress];
    }
    
    /**
     * @dev Check if user has specific role
     * @param userAddress Address to check
     * @param requiredRole Role to check for
     * @return hasRole Whether user has the required role
     */
    function result(address userAddress, Role requiredRole) external view returns (bool hasRole) {
        if (!isRegistered[userAddress]) return false;
        return users[userAddress].role == requiredRole;
    }
    
    // ============ SEARCH USERS BY ROLE ============
    
    /**
     * @dev Get all users with a specific role
     * @param targetRole Role to search for
     * @return userAddresses Array of addresses with the specified role
     * @return userNames Array of display names (same order as addresses)
     */
    function getUsersByRole(Role targetRole) external view returns (
        address[] memory userAddresses,
        string[] memory userNames
    ) {
        // First pass: count users with the role
        uint256 count = 0;
        for (uint256 i = 0; i < registeredUsers.length; i++) {
            if (users[registeredUsers[i]].role == targetRole) {
                count++;
            }
        }
        
        // Create arrays with exact size
        address[] memory addresses = new address[](count);
        string[] memory names = new string[](count);
        
        // Second pass: populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < registeredUsers.length; i++) {
            address userAddr = registeredUsers[i];
            if (users[userAddr].role == targetRole) {
                addresses[index] = userAddr;
                names[index] = users[userAddr].displayName;
                index++;
            }
        }
        
        return (addresses, names);
    }
    
    // ============ UTILITY FUNCTIONS ============
    
    /**
     * @dev Get total number of registered users
     * @return count Total registered users
     */
    function getTotalUsers() external view returns (uint256 count) {
        return registeredUsers.length;
    }
    
    /**
     * @dev Get all registered users (for admin purposes)
     * @return userAddresses Array of all registered user addresses
     */
    function getAllUsers() external view returns (address[] memory userAddresses) {
        return registeredUsers;
    }
    
    /**
     * @dev Get user statistics by role
     * @return managers Number of managers
     * @return sellers Number of sellers
     * @return suppliers Number of suppliers
     */
    function getUserStats() external view returns (
        uint256 managers,
        uint256 sellers,
        uint256 suppliers
    ) {
        for (uint256 i = 0; i < registeredUsers.length; i++) {
            Role userRole = users[registeredUsers[i]].role;
            
            if (userRole == Role.Manager) {
                managers++;
            } else if (userRole == Role.Seller) {
                sellers++;
            } else if (userRole == Role.Supplier) {
                suppliers++;
            }
        }
        
        return (managers, sellers, suppliers);
    }
    
    /**
     * @dev Get all registered users with detailed information
     * @return userAddresses Array of user addresses
     * @return roles Array of user roles (1=Manager, 2=Seller, 3=Supplier)
     * @return displayNames Array of user display names
     * @return registeredAts Array of registration timestamps
     * @return registeredBys Array of who registered each user
     */
    function getAllUsersWithDetails() external view returns (
        address[] memory userAddresses,
        Role[] memory roles,
        string[] memory displayNames,
        uint256[] memory registeredAts,
        address[] memory registeredBys
    ) {
        uint256 totalUsers = registeredUsers.length;
        
        userAddresses = new address[](totalUsers);
        roles = new Role[](totalUsers);
        displayNames = new string[](totalUsers);
        registeredAts = new uint256[](totalUsers);
        registeredBys = new address[](totalUsers);
        
        for (uint256 i = 0; i < totalUsers; i++) {
            address userAddr = registeredUsers[i];
            User memory user = users[userAddr];
            
            userAddresses[i] = userAddr;
            roles[i] = user.role;
            displayNames[i] = user.displayName;
            registeredAts[i] = user.registeredAt;
            registeredBys[i] = user.registeredBy;
        }
        
        return (userAddresses, roles, displayNames, registeredAts, registeredBys);
    }
}