// Static data tables consumed by the tutorial visualizers. Kept apart from the
// curriculum text so the (lazy-loaded, per-language) curricula don't pin this file
// and vice versa.

export const ARCHITECTURE_STEPS = [
  { id: 'client', label: 'Client' },
  { id: 'gateway', label: 'API Gateway' },
  { id: 'security', label: 'Security Filter' },
  { id: 'controller', label: 'REST / GraphQL' },
  { id: 'cache', label: 'Cache (Redis)' },
  { id: 'service', label: 'Service (Tx Boundary)' },
  { id: 'event-bus', label: 'Event Bus' },
  { id: 'repository', label: 'JPA / Mongo' },
  { id: 'database', label: 'Database' },
  { id: 'broker', label: 'Message Broker' }
];

export const BEAN_LIFECYCLE_STEPS = [
  { 
    id: 'instantiation', 
    label: 'Instantiation', 
    description: 'The JVM creates the object instance using the constructor.',
    details: 'Dependencies are NOT yet injected. Fields are null or default values.'
  },
  { 
    id: 'populate', 
    label: 'Populate Properties', 
    description: 'Spring injects dependencies via @Autowired or setters.',
    details: 'Setter injection and field injection happen here. Constructor injection happened in step 1.'
  },
  { 
    id: 'aware', 
    label: 'Aware Interfaces', 
    description: 'Spring calls methods on beans that implement "Aware" interfaces.',
    details: 'BeanNameAware, BeanFactoryAware, ApplicationContextAware are notified.'
  },
  { 
    id: 'pre-init', 
    label: 'Pre-Initialization', 
    description: 'BeanPostProcessors are called before initialization.',
    details: 'postProcessBeforeInitialization() is executed for all registered BPPs.'
  },
  { 
    id: 'init', 
    label: 'Initialization', 
    description: 'The @PostConstruct method or InitializingBean.afterPropertiesSet() is called.',
    details: 'The bean is now fully configured and ready for custom initialization logic.'
  },
  { 
    id: 'post-init', 
    label: 'Post-Initialization', 
    description: 'BeanPostProcessors are called after initialization.',
    details: 'This is where AOP proxies (like @Transactional) are typically created.'
  },
  { 
    id: 'ready', 
    label: 'Ready for Use', 
    description: 'The bean is now fully managed and available in the ApplicationContext.',
    details: 'Other beans can now receive this bean as a dependency.'
  },
  { 
    id: 'destroy', 
    label: 'Destruction', 
    description: 'The @PreDestroy method or DisposableBean.destroy() is called.',
    details: 'Triggered when the ApplicationContext is closed (e.g., app shutdown).'
  }
];

export const SECURITY_FILTERS = [
  {
    id: 'cors',
    name: 'CorsFilter',
    description: 'Handles Cross-Origin Resource Sharing (CORS) preflight requests.',
    role: 'Infrastructure'
  },
  {
    id: 'csrf',
    name: 'CsrfFilter',
    description: 'Protects against Cross-Site Request Forgery by validating tokens.',
    role: 'Protection'
  },
  {
    id: 'jwt',
    name: 'JwtAuthenticationFilter',
    description: 'Custom filter to extract and validate JWT from Authorization header.',
    role: 'Authentication'
  },
  {
    id: 'basic',
    name: 'BasicAuthenticationFilter',
    description: 'Processes HTTP Basic authentication headers.',
    role: 'Authentication'
  },
  {
    id: 'username-password',
    name: 'UsernamePasswordAuthenticationFilter',
    description: 'Processes form-based login submissions.',
    role: 'Authentication'
  },
  {
    id: 'exception',
    name: 'ExceptionTranslationFilter',
    description: 'Translates Spring Security exceptions into HTTP responses.',
    role: 'Error Handling'
  },
  {
    id: 'authorization',
    name: 'AuthorizationFilter',
    description: 'Final check to ensure user has required roles for the resource.',
    role: 'Authorization'
  }
];

export const JPA_MAPPING_SCENARIOS = [
  {
    id: 'basic',
    title: 'Basic Entity',
    javaCode: `@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String email;

    @Transient
    private String tempToken;
}`,
    tableName: 'users',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK, AUTO_INC' },
      { name: 'name', type: 'VARCHAR(255)', constraints: 'NOT NULL' },
      { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE' }
    ],
    explanation: 'Basic mapping: @Id becomes Primary Key, @Column defines constraints, @Transient is ignored by the database.'
  },
  {
    id: 'one-to-many',
    title: 'One-to-Many Relationship',
    javaCode: `@Entity
public class Customer {
    @Id private Long id;
    
    @OneToMany(mappedBy = "customer")
    private List<Order> orders;
}

@Entity
public class Order {
    @Id private Long id;
    
    @ManyToOne
    @JoinColumn(name = "customer_id")
    private Customer customer;
}`,
    tableName: 'orders',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK' },
      { name: 'customer_id', type: 'BIGINT', constraints: 'FK (customers.id)' }
    ],
    explanation: 'The @ManyToOne side owns the relationship. @JoinColumn creates the Foreign Key column in the "orders" table.'
  },
  {
    id: 'inheritance',
    title: 'Inheritance (Single Table)',
    javaCode: `@Entity
@Inheritance(strategy = InheritanceType.SINGLE_TABLE)
@DiscriminatorColumn(name = "type")
public abstract class Payment {
    @Id private Long id;
    private BigDecimal amount;
}

@Entity
public class CreditCardPayment extends Payment {}

@Entity
public class PaypalPayment extends Payment {}`,
    tableName: 'payment',
    columns: [
      { name: 'id', type: 'BIGINT', constraints: 'PK' },
      { name: 'amount', type: 'DECIMAL', constraints: '' },
      { name: 'type', type: 'VARCHAR', constraints: 'DISCRIMINATOR' },
      { name: 'card_number', type: 'VARCHAR', constraints: 'NULLABLE' },
      { name: 'paypal_email', type: 'VARCHAR', constraints: 'NULLABLE' }
    ],
    explanation: 'SINGLE_TABLE strategy puts all fields from subclasses into one table. A "discriminator" column tells Hibernate which subclass to instantiate.'
  }
];

export const TOPOLOGY_DATA = {
  nodes: [
    { id: 'client', label: 'Client App', type: 'client', description: 'React/Mobile Frontend' },
    { id: 'gateway', label: 'API Gateway', type: 'infrastructure', description: 'Spring Cloud Gateway - Entry point, Security, Routing' },
    { id: 'eureka', label: 'Service Registry', type: 'infrastructure', description: 'Netflix Eureka - Service Discovery' },
    { id: 'config', label: 'Config Server', type: 'infrastructure', description: 'Spring Cloud Config - Centralized configuration' },
    { id: 'auth-service', label: 'Auth Service', type: 'service', description: 'JWT Issuance, User Authentication' },
    { id: 'order-service', label: 'Order Service', type: 'service', description: 'Manages customer orders' },
    { id: 'inventory-service', label: 'Inventory Service', type: 'service', description: 'Stock management' },
    { id: 'payment-service', label: 'Payment Service', type: 'service', description: 'Third-party payment integration' },
    { id: 'broker', label: 'Message Broker', type: 'infrastructure', description: 'RabbitMQ/Kafka - Async communication' },
    { id: 'database', label: 'Database', type: 'database', description: 'PostgreSQL/MongoDB' }
  ],
  links: [
    { source: 'client', target: 'gateway', label: 'HTTPS' },
    { source: 'gateway', target: 'auth-service', label: 'Auth Check' },
    { source: 'gateway', target: 'order-service', label: 'Route' },
    { source: 'order-service', target: 'inventory-service', label: 'gRPC/REST' },
    { source: 'order-service', target: 'payment-service', label: 'REST' },
    { source: 'order-service', target: 'broker', label: 'Event' },
    { source: 'inventory-service', target: 'broker', label: 'Listen' },
    { source: 'all-services', target: 'eureka', label: 'Register', special: true },
    { source: 'all-services', target: 'config', label: 'Fetch Config', special: true },
    { source: 'all-services', target: 'database', label: 'Persist', special: true }
  ]
};
