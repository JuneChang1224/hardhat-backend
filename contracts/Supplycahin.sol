// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SupplyChain
 * @dev Production version - ingredient source traceability without supplier management
 * @notice No admin restrictions - anyone can add ingredients and create products
 */
contract SupplyChain {
    
    // ============ SIMPLIFIED STRUCTS ============
    
    struct Ingredient {
        string name;            // Ingredient name: "Organic Tomatoes"
        address supplierAddr;   // Direct supplier address - no registration needed
        string category;        // Type: "Vegetables", "Dairy", etc.
        bool available;         // Is ingredient currently available
        uint256 addedAt;        // When ingredient was added
    }
    
    struct Product {
        string name;            // Product name: "Pizza Sauce"
        string batchId;         // Batch identifier: "PS-2024-001"  
        uint256[] ingredientIds; // Which ingredients are used
        address[] suppliers;    // Auto-collected supplier addresses
        uint8 approved;         // How many suppliers approved
        uint8 total;           // Total suppliers needed for approval
        uint8 status;          // 0=Created, 1=Pending, 2=Approved, 3=Rejected
        uint256 createdAt;     // When product batch was created
        uint256 approvedAt;    // When all suppliers approved (auto-set)
    }
    
    struct ApprovalInfo {
        address supplier;       // Who responded
        uint8 status;          // 1=Approved, 2=Rejected
        uint256 respondedAt;   // When they responded
    }
    
    // ============ STATE ============
    
    uint256 public nextIId = 1;     // Next ingredient ID
    uint256 public nextPId = 1;     // Next product ID
    
    mapping(uint256 => Ingredient) public ingredients;
    mapping(uint256 => Product) public products;
    mapping(uint256 => mapping(address => uint8)) public approvals; // Product → Supplier → Status  
    mapping(uint256 => ApprovalInfo[]) public approvalHistory;      // Product approval timeline
    
    // ============ EVENTS ============
    
    event IngredientAdded(uint256 indexed id, string name, address indexed supplierAddr, string category, uint256 timestamp);
    event ProductCreated(uint256 indexed id, string name, string batchId, address[] suppliers, uint256 timestamp);
    event ProductApproved(uint256 indexed id, address indexed supplier, uint256 timestamp);
    event ProductRejected(uint256 indexed id, address indexed supplier, uint256 timestamp);
    event ProductFullyApproved(uint256 indexed id, string name, string batchId, uint256 timestamp);
    
    // ============ MODIFIERS ============
    
    modifier onlySupplier(uint256 pId) { 
        require(isSupplierInProduct(pId, msg.sender) && approvals[pId][msg.sender] == 0, "Not authorized supplier"); 
        _; 
    }
    
    constructor() { }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Add ingredient - anyone can add ingredients
     */
    function addIngredient(string memory name, address supplierAddr, string memory category) 
        external returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(supplierAddr != address(0), "Invalid supplier address");
        require(bytes(category).length > 0, "Category required");
        
        uint256 id = nextIId++;
        uint256 timestamp = block.timestamp;
        
        ingredients[id] = Ingredient(name, supplierAddr, category, true, timestamp);
        
        emit IngredientAdded(id, name, supplierAddr, category, timestamp);
        return id;
    }
    
    /**
     * @dev Create product batch - anyone can create products
     */
    function createProduct(string memory name, string memory batchId, uint256[] memory ingredientIds) 
        external returns (uint256) {
        require(bytes(name).length > 0, "Product name required");
        require(bytes(batchId).length > 0, "Batch ID required");
        require(ingredientIds.length > 0, "Need at least one ingredient");
        
        // Auto-collect unique supplier addresses from ingredients
        address[] memory uniqueSuppliers = getUniqueSuppliers(ingredientIds);
        require(uniqueSuppliers.length > 0, "No valid suppliers found");
        
        uint256 id = nextPId++;
        uint256 timestamp = block.timestamp;
        
        products[id] = Product(
            name, 
            batchId, 
            ingredientIds, 
            uniqueSuppliers, 
            0, 
            uint8(uniqueSuppliers.length), 
            0, 
            timestamp, 
            0
        );
        
        emit ProductCreated(id, name, batchId, uniqueSuppliers, timestamp);
        return id;
    }
    
    /**
     * @dev Supplier approves their involvement in product batch
     */
    function approveProduct(uint256 pId) external onlySupplier(pId) {
        uint256 timestamp = block.timestamp;
        
        approvals[pId][msg.sender] = 1;
        products[pId].approved++;
        
        approvalHistory[pId].push(ApprovalInfo(msg.sender, 1, timestamp));
        
        if (products[pId].approved == products[pId].total) {
            products[pId].status = 2; // Fully Approved - now visible!
            products[pId].approvedAt = timestamp; // Auto-set approval timestamp
            emit ProductFullyApproved(pId, products[pId].name, products[pId].batchId, timestamp);
        } else {
            products[pId].status = 1; // Pending
        }
        
        emit ProductApproved(pId, msg.sender, timestamp);
    }
    
    /**
     * @dev Supplier rejects involvement in product batch
     */
    function rejectProduct(uint256 pId) external onlySupplier(pId) {
        uint256 timestamp = block.timestamp;
        
        approvals[pId][msg.sender] = 2;
        products[pId].status = 3; // Rejected
        products[pId].approvedAt = timestamp; // Set finalization timestamp
        
        approvalHistory[pId].push(ApprovalInfo(msg.sender, 2, timestamp));
        
        emit ProductRejected(pId, msg.sender, timestamp);
    }
    

    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get complete product traceability - main function for transparency
     */
    function getProductTraceability(uint256 pId) external view returns (
        string memory productName,
        string memory batchId,
        string[] memory ingredientNames,
        string[] memory ingredientCategories,
        address[] memory supplierAddresses,
        uint256 createdAt,
        uint256 approvedAt,
        uint8 status
    ) {
        require(pId < nextPId && pId > 0, "Invalid product ID");
        require(products[pId].status == 2, "Product not fully approved yet"); // Only show approved products
        
        Product memory p = products[pId];
        
        // Build ingredient details
        string[] memory ingNames = new string[](p.ingredientIds.length);
        string[] memory ingCategories = new string[](p.ingredientIds.length);
        
        for (uint256 i = 0; i < p.ingredientIds.length; i++) {
            Ingredient memory ingredient = ingredients[p.ingredientIds[i]];
            ingNames[i] = ingredient.name;
            ingCategories[i] = ingredient.category;
        }
        
        return (
            p.name,
            p.batchId, 
            ingNames,
            ingCategories,
            p.suppliers,
            p.createdAt,
            p.approvedAt,
            p.status
        );
    }
    
    /**
     * @dev Get basic product info
     */
    function getProduct(uint256 pId) external view returns (
        string memory name,
        string memory batchId,
        uint256[] memory ingredientIds,
        address[] memory supplierAddresses,
        uint8 approved,
        uint8 total,
        uint8 status,
        uint256 createdAt,
        uint256 approvedAt
    ) {
        require(pId < nextPId && pId > 0, "Invalid product ID");
        Product memory p = products[pId];
        return (p.name, p.batchId, p.ingredientIds, p.suppliers, p.approved, p.total, p.status, p.createdAt, p.approvedAt);
    }
    
    /**
     * @dev Get ingredient info - now includes supplier address directly
     */
    function getIngredient(uint256 id) external view returns (
        string memory name,
        address supplierAddr,
        string memory category,
        bool available,
        uint256 addedAt
    ) {
        require(id < nextIId && id > 0, "Invalid ingredient ID");
        Ingredient memory i = ingredients[id];
        return (i.name, i.supplierAddr, i.category, i.available, i.addedAt);
    }
    
    /**
     * @dev Get approval progress
     */
    function getProgress(uint256 pId) external view returns (
        uint8 approved,
        uint8 total,
        uint8 status,
        uint256 progressPercentage
    ) {
        require(pId < nextPId && pId > 0, "Invalid product ID");
        Product memory p = products[pId];
        uint256 percentage = p.total > 0 ? (p.approved * 100) / p.total : 0;
        return (p.approved, p.total, p.status, percentage);
    }
    
    /**
     * @dev Get all approved products (public - only shows fully approved products)
     */
    function getApprovedProducts() external view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](nextPId);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextPId; i++) {
            if (products[i].status == 2) { // Fully Approved
                temp[count++] = i;
            }
        }
        
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }
    
    function getCounts() external view returns (uint256 ingredients_, uint256 products_) {
        return (nextIId - 1, nextPId - 1);
    }
    
    // ============ DROPDOWN HELPER FUNCTIONS ============
    
    /**
     * @dev Get all available ingredients - simplified for dropdown display
     */
    function getAllAvailableIngredients() external view returns (
        uint256[] memory ids,
        string[] memory names,
        string[] memory categories,
        address[] memory supplierAddresses
    ) {
        uint256[] memory tempIds = new uint256[](nextIId);
        string[] memory tempNames = new string[](nextIId);
        string[] memory tempCategories = new string[](nextIId);
        address[] memory tempSupplierAddrs = new address[](nextIId);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextIId; i++) {
            if (ingredients[i].available) {
                tempIds[count] = i;
                tempNames[count] = ingredients[i].name;
                tempCategories[count] = ingredients[i].category;
                tempSupplierAddrs[count] = ingredients[i].supplierAddr;
                count++;
            }
        }
        
        // Resize arrays
        ids = new uint256[](count);
        names = new string[](count);
        categories = new string[](count);
        supplierAddresses = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            ids[i] = tempIds[i];
            names[i] = tempNames[i];
            categories[i] = tempCategories[i];
            supplierAddresses[i] = tempSupplierAddrs[i];
        }
        
        return (ids, names, categories, supplierAddresses);
    }

    function getAllProducts() external view returns (uint256[] memory) {
        uint256 totalProducts = nextPId - 1; // Exclude ID 0
        uint256[] memory result = new uint256[](totalProducts);
        
        for (uint256 i = 1; i < nextPId; i++) {
            result[i - 1] = i; // Store product ID at index (i-1)
        }
        
        return result;
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function getUniqueSuppliers(uint256[] memory ingredientIds) internal view returns (address[] memory) {
        address[] memory temp = new address[](ingredientIds.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < ingredientIds.length; i++) {
            require(ingredientIds[i] < nextIId && ingredients[ingredientIds[i]].available, "Invalid or unavailable ingredient");
            
            address supplierAddr = ingredients[ingredientIds[i]].supplierAddr;
            
            bool exists = false;
            for (uint256 j = 0; j < count; j++) {
                if (temp[j] == supplierAddr) {
                    exists = true;
                    break;
                }
            }
            
            if (!exists) temp[count++] = supplierAddr;
        }
        
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }
    
    function isSupplierInProduct(uint256 pId, address supplier) internal view returns (bool) {
        if (pId >= nextPId) return false;
        
        address[] memory productSuppliers = products[pId].suppliers;
        for (uint256 i = 0; i < productSuppliers.length; i++) {
            if (productSuppliers[i] == supplier) return true;
        }
        return false;
    }
}